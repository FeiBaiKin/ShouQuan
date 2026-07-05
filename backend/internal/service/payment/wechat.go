package payment

import (
	"crypto"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net/http"
	"strings"
	"time"
)

func init() { Register(WechatProvider{}) }

type WechatProvider struct{}

func (WechatProvider) Name() string     { return "wechat" }
func (WechatProvider) Label() string    { return "微信支付" }
func (WechatProvider) Scenes() []string { return []string{"native"} }

func (WechatProvider) CreatePayment(order Order, cfg PaymentConfig, scene string, extra map[string]string) (PaymentResult, error) {
	if cfg.WxAppId == "" || cfg.WxMchId == "" || cfg.WxPrivateKey == "" {
		return PaymentResult{}, fmt.Errorf("微信支付配置不完整")
	}
	description := order.Subject
	if description == "" {
		description = "授权购买"
	}
	body := map[string]any{
		"appid":        cfg.WxAppId,
		"mchid":        cfg.WxMchId,
		"description":  description,
		"out_trade_no": order.OrderNo,
		"notify_url":   cfg.WxNotifyUrl,
		"amount":       map[string]any{"total": int(math.Round(order.Amount * 100)), "currency": "CNY"},
	}
	bodyBytes, _ := json.Marshal(body)

	timestamp := fmt.Sprintf("%d", time.Now().Unix())
	nonce := randHex(32)
	signStr := fmt.Sprintf("POST\n/v3/pay/transactions/native\n%s\n%s\n%s\n", timestamp, nonce, string(bodyBytes))
	sig, err := signRSA(signStr, cfg.WxPrivateKey)
	if err != nil {
		return PaymentResult{}, fmt.Errorf("签名失败: %v", err)
	}
	auth := fmt.Sprintf(`WECHATPAY2-SHA256-RSA2048 mchid="%s",nonce_str="%s",signature="%s",timestamp="%s",serial_no="%s"`,
		cfg.WxMchId, nonce, sig, timestamp, cfg.WxSerialNo)

	req, _ := http.NewRequest("POST", "https://api.mch.weixin.qq.com/v3/pay/transactions/native", strings.NewReader(string(bodyBytes)))
	req.Header.Set("Authorization", auth)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := PaymentHTTPClient.Do(req)
	if err != nil {
		return PaymentResult{}, fmt.Errorf("请求微信支付失败: %v", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return PaymentResult{}, fmt.Errorf("微信支付返回错误: %s", string(respBody))
	}
	var result struct {
		CodeUrl string `json:"code_url"`
	}
	json.Unmarshal(respBody, &result)
	return PaymentResult{Type: "wechat", Scene: "native", PayUrl: result.CodeUrl, QRCode: result.CodeUrl}, nil
}

func (WechatProvider) VerifyCallback(req CallbackRequest, cfg PaymentConfig) (CallbackResult, error) {
	if cfg.WxApiV3Key == "" {
		return CallbackResult{Skip: true, Error: "微信支付配置不完整"}, nil
	}

	// 微信 V3 回调 JSON 结构：{ resource: { algorithm, ciphertext, associated_data, nonce, original_type } }
	var body struct {
		Resource struct {
			Ciphertext     string `json:"ciphertext"`
			AssociatedData string `json:"associated_data"`
			Nonce          string `json:"nonce"`
		} `json:"resource"`
	}
	if err := json.Unmarshal(req.Body, &body); err != nil || body.Resource.Ciphertext == "" {
		slog.Error("[微信支付] 回调体无效", "err", err)
		return CallbackResult{Verified: false, Error: "回调体无效"}, nil
	}

	// AEAD_AES_256_GCM 解密 resource.ciphertext（APIv3Key 即 32 字节对称密钥）
	plain, err := decryptAES256GCM(body.Resource.Ciphertext, cfg.WxApiV3Key, body.Resource.Nonce, body.Resource.AssociatedData)
	if err != nil {
		slog.Error("[微信支付] 解密回调失败", "err", err)
		return CallbackResult{Verified: false, Error: "解密失败: " + err.Error()}, nil
	}

	var res struct {
		OutTradeNo    string `json:"out_trade_no"`
		TradeState    string `json:"trade_state"`
		TransactionID string `json:"transaction_id"`
		Amount        struct {
			Total      int `json:"total"`
			PayerTotal int `json:"payer_total"`
		} `json:"amount"`
	}
	if err := json.Unmarshal(plain, &res); err != nil {
		return CallbackResult{Verified: false, Error: "解密结果解析失败"}, nil
	}

	// 仅支付成功才入账，其余状态跳过
	if res.TradeState != "SUCCESS" {
		slog.Info("[微信支付] 订单状态非 SUCCESS，忽略", "orderNo", res.OutTradeNo, "state", res.TradeState)
		return CallbackResult{Skip: true, Error: "订单状态: " + res.TradeState}, nil
	}

	total := res.Amount.PayerTotal
	if total == 0 {
		total = res.Amount.Total
	}
	return CallbackResult{
		Verified: true,
		OrderNo:  res.OutTradeNo,
		Amount:   float64(total) / 100, // 分 → 元
		TradeNo:  res.TransactionID,
	}, nil
}

// decryptAES256GCM 微信支付 V3 回调 resource.ciphertext 解密（AEAD_AES_256_GCM）。
// 微信密文格式为「数据 || 16 字节 authTag」，与 Go cipher.AEAD.Open 期望的
// 「密文+tag 拼接」格式一致，故可直接将 base64 解码后的整体字节传入 Open。
func decryptAES256GCM(ciphertextB64, key, nonce, associatedData string) ([]byte, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(ciphertextB64)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher([]byte(key)) // key 需为 32 字节（APIv3Key）
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return gcm.Open(nil, []byte(nonce), ciphertext, []byte(associatedData))
}

func signRSA(data, privateKeyPEM string) (string, error) {
	block, _ := pem.Decode([]byte(fixPEM(privateKeyPEM, "PRIVATE KEY")))
	if block == nil {
		return "", fmt.Errorf("无法解析私钥")
	}
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		key, err = x509.ParsePKCS1PrivateKey(block.Bytes)
		if err != nil {
			return "", err
		}
	}
	rsaKey, ok := key.(*rsa.PrivateKey)
	if !ok {
		return "", fmt.Errorf("不是 RSA 私钥")
	}
	h := sha256.Sum256([]byte(data))
	sig, err := rsa.SignPKCS1v15(rand.Reader, rsaKey, crypto.SHA256, h[:])
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(sig), nil
}

func fixPEM(raw, typ string) string {
	s := strings.ReplaceAll(raw, "\\n", "\n")
	if strings.Contains(s, "-----BEGIN") {
		return s
	}
	lines := splitN(s, 64)
	return "-----BEGIN " + typ + "-----\n" + strings.Join(lines, "\n") + "\n-----END " + typ + "-----"
}

func randHex(n int) string {
	b := make([]byte, n/2)
	rand.Read(b)
	return fmt.Sprintf("%X", b)
}

func splitN(s string, n int) []string {
	var lines []string
	for i := 0; i < len(s); i += n {
		end := i + n
		if end > len(s) {
			end = len(s)
		}
		lines = append(lines, s[i:end])
	}
	return lines
}
