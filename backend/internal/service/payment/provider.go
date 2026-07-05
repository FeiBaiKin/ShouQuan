package payment

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"authcenter/backend/internal/models"
	"authcenter/backend/internal/util"
)

// PaymentHTTPClient 所有支付网关请求共享的 HTTP 客户端。
// 设置合理超时避免网关慢响应导致 goroutine 堆积（http.DefaultClient 无超时）。
var PaymentHTTPClient = &http.Client{
	Timeout: 15 * time.Second,
	Transport: &http.Transport{
		DialContext:           (&net.Dialer{Timeout: 5 * time.Second, KeepAlive: 30 * time.Second}).DialContext,
		MaxIdleConns:          50,
		MaxIdleConnsPerHost:   10,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   5 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	},
}

// ====== Provider 接口 ======

// Order 下单入参。Subject 由调用方填充（如「XZJI 年付授权」）
type Order struct {
	OrderNo string
	Amount  float64
	Subject string
}

type PaymentConfig struct {
	SiteURL string
	// 微信
	WxAppId, WxMchId, WxSerialNo, WxApiV3Key, WxPrivateKey, WxNotifyUrl string
	WxPlatformSerialNo, WxPlatformPublicKey                             string
	// 支付宝
	AliAppId, AliPrivateKey, AliPublicKey, AliScene, AliNotifyUrl, AliReturnUrl string
	// 已启用的支付方式（来自 settings 表 payment_enabled_providers）
	EnabledProviders []string
}

type PaymentResult struct {
	Type   string `json:"type"`   // wechat / alipay
	Scene  string `json:"scene"`  // native / page / wap / precreate
	PayUrl string `json:"payUrl"` // 支付链接或二维码内容
	QRCode string `json:"qrCode"` // 二维码数据（微信 native / 支付宝 precreate 返回 qr_code）
}

type CallbackRequest struct {
	Method  string
	Body    []byte
	Query   map[string]string
	Headers map[string]string
}

type CallbackResult struct {
	Verified bool
	Skip     bool // 跳过处理（非交易成功事件）
	Error    string
	OrderNo  string
	Amount   float64
	TradeNo  string
}

type Provider interface {
	Name() string
	Label() string
	Scenes() []string
	CreatePayment(order Order, cfg PaymentConfig, scene string, extra map[string]string) (PaymentResult, error)
	VerifyCallback(req CallbackRequest, cfg PaymentConfig) (CallbackResult, error)
}

// ====== 注册表 ======

var providers = map[string]Provider{}

func Register(p Provider) { providers[p.Name()] = p }
func Get(name string) (Provider, error) {
	if p, ok := providers[name]; ok {
		return p, nil
	}
	return nil, fmt.Errorf("不支持的支付方式: %s", name)
}

// EnabledMethods 返回已启用的支付方式列表（按 EnabledProviders 顺序）
func EnabledMethods(cfg PaymentConfig) []map[string]any {
	var out []map[string]any
	for _, name := range cfg.EnabledProviders {
		if p, ok := providers[name]; ok {
			out = append(out, map[string]any{"name": p.Name(), "label": p.Label(), "scenes": p.Scenes()})
		}
	}
	return out
}

// ====== 通用：获取支付配置（从 settings 表读取） ======

// GetPaymentConfig 从 settings 表读取支付配置。
// 配置 key 约定：payment_site_url / payment_enabled_providers（JSON 数组）/ payment_wx_* / payment_ali_*
func GetPaymentConfig(db *gorm.DB, fallbackSiteURL string) PaymentConfig {
	var rows []models.Setting
	db.Where("setting_key LIKE ?", "payment_%").Find(&rows)
	cfg := PaymentConfig{}

	m := map[string]string{}
	for _, r := range rows {
		m[r.Key] = r.Value
	}

	siteURL := strings.TrimRight(m["payment_site_url"], "/")
	if siteURL == "" {
		siteURL = strings.TrimRight(fallbackSiteURL, "/")
	}
	cfg.SiteURL = siteURL

	// 已启用的支付方式（payment_enabled_providers 存为 JSON 字符串）
	if raw := m["payment_enabled_providers"]; raw != "" {
		var arr []string
		if err := json.Unmarshal([]byte(raw), &arr); err == nil && len(arr) > 0 {
			cfg.EnabledProviders = arr
		}
	}
	if cfg.EnabledProviders == nil {
		cfg.EnabledProviders = []string{}
	}

	cfg.WxAppId = m["payment_wx_appid"]
	cfg.WxMchId = m["payment_wx_mchid"]
	cfg.WxSerialNo = m["payment_wx_serial_no"]
	cfg.WxApiV3Key = m["payment_wx_api_v3_key"]
	cfg.WxPrivateKey = m["payment_wx_private_key"]
	cfg.WxPlatformSerialNo = m["payment_wx_platform_serial_no"]
	cfg.WxPlatformPublicKey = m["payment_wx_platform_public_key"]
	cfg.WxNotifyUrl = normalizeURL(m["payment_wx_notify_url"])
	if cfg.WxNotifyUrl == "" && siteURL != "" {
		cfg.WxNotifyUrl = siteURL + "/api/payment/callback/wechat"
	}

	cfg.AliAppId = m["payment_ali_appid"]
	cfg.AliPrivateKey = m["payment_ali_private_key"]
	cfg.AliPublicKey = m["payment_ali_public_key"]
	cfg.AliScene = m["payment_ali_scene"]
	if cfg.AliScene == "" {
		cfg.AliScene = "page"
	}
	cfg.AliNotifyUrl = normalizeURL(m["payment_ali_notify_url"])
	if cfg.AliNotifyUrl == "" && siteURL != "" {
		cfg.AliNotifyUrl = siteURL + "/api/payment/callback/alipay"
	}
	cfg.AliReturnUrl = normalizeURL(m["payment_ali_return_url"])
	if cfg.AliReturnUrl == "" && siteURL != "" {
		cfg.AliReturnUrl = siteURL + "/pay-result?order="
	}

	return cfg
}

// normalizeURL 清理 URL 中路径部分的连续斜杠（如 //api → /api），保留协议双斜杠 (https://)
func normalizeURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	var scheme, rest string
	if idx := strings.Index(raw, "://"); idx >= 0 {
		scheme = raw[:idx+3]
		rest = raw[idx+3:]
	} else {
		rest = raw
	}
	for strings.Contains(rest, "//") {
		rest = strings.ReplaceAll(rest, "//", "/")
	}
	rest = strings.TrimRight(rest, "/")
	return scheme + rest
}

// ====== 通用：ProcessPaidOrder（事务：订单入账 + 自动生成授权码） ======

// ProcessPaidOrder 支付回调验签通过后调用：
// 1. 行锁查订单，金额校验
// 2. 已 paid 幂等返回
// 3. 标记订单 paid、回填 trade_no
// 4. 生成授权码、创建 License（status=unactivated）、写 license_events
// 5. 回填订单 LicenseID
// 返回 (订单, 是否新建授权)。
func ProcessPaidOrder(db *gorm.DB, orderNo, paidAmount, tradeNo string) (*models.PurchaseOrder, bool, error) {
	tx := db.Begin()
	if tx.Error != nil {
		return nil, false, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var order models.PurchaseOrder
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("order_no = ?", orderNo).First(&order).Error; err != nil {
		tx.Rollback()
		return nil, false, fmt.Errorf("订单不存在")
	}

	// 金额前置校验
	amt := 0.0
	fmt.Sscanf(paidAmount, "%f", &amt)
	if amt <= 0 {
		tx.Rollback()
		return nil, false, fmt.Errorf("无效的支付金额")
	}
	if diff := amt - order.Amount; diff > 0.01 || diff < -0.01 {
		tx.Rollback()
		return nil, false, fmt.Errorf("支付金额不匹配")
	}

	// 幂等：已 paid 直接返回
	if order.Status == models.OrderPaid {
		if err := tx.Commit().Error; err != nil {
			return nil, false, err
		}
		return &order, false, nil
	}
	if order.Status == models.OrderExpired || order.Status == models.OrderClosed {
		if err := tx.Commit().Error; err != nil {
			return nil, false, err
		}
		return &order, false, nil
	}
	if order.Status != models.OrderPending {
		tx.Rollback()
		return nil, false, fmt.Errorf("订单状态不可入账: %s", order.Status)
	}
	if order.ExpiresAt != nil && time.Now().After(*order.ExpiresAt) {
		if err := tx.Model(&order).Updates(map[string]any{
			"status":   models.OrderExpired,
			"trade_no": tradeNo,
		}).Error; err != nil {
			tx.Rollback()
			return nil, false, err
		}
		if err := tx.Commit().Error; err != nil {
			return nil, false, err
		}
		order.Status = models.OrderExpired
		order.TradeNo = tradeNo
		slog.Warn("[支付] 订单已过期，跳过授权生成", "orderNo", order.OrderNo, "tradeNo", tradeNo)
		return &order, false, nil
	}

	// 加载套餐与产品（生成授权码需要期限类型/天数 + 产品ID）
	var plan models.PricingPlan
	if err := tx.First(&plan, order.PlanID).Error; err != nil {
		tx.Rollback()
		return nil, false, fmt.Errorf("套餐不存在: %w", err)
	}

	// 生成授权码（撞码重试 5 次）
	var code string
	for attempt := 0; attempt < 5; attempt++ {
		candidate, err := util.GenerateLicenseCode()
		if err != nil {
			tx.Rollback()
			return nil, false, fmt.Errorf("生成授权码失败: %w", err)
		}
		var count int64
		tx.Model(&models.License{}).Where("code = ?", candidate).Count(&count)
		if count == 0 {
			code = candidate
			break
		}
	}
	if code == "" {
		tx.Rollback()
		return nil, false, fmt.Errorf("生成授权码失败（重复冲突）")
	}

	// 创建 License（未激活状态，激活时由接入方调 /api/v1/activate 起算有效期）
	durationDays := plan.DurationDays
	switch plan.DurationType {
	case models.DurationYearly:
		durationDays = 365
	case models.DurationPermanent:
		durationDays = 0
	}
	license := models.License{
		ProductID:       order.ProductID,
		Code:            code,
		CustomerName:    order.CustomerName,
		CustomerContact: order.Email,
		Remark:          fmt.Sprintf("购买订单 %s（%s）", order.OrderNo, plan.Name),
		DurationType:    plan.DurationType,
		DurationDays:    durationDays,
		Status:          models.LicenseUnactivated,
	}
	if err := tx.Create(&license).Error; err != nil {
		tx.Rollback()
		return nil, false, fmt.Errorf("创建授权失败: %w", err)
	}
	tx.Create(&models.LicenseEvent{
		LicenseID: license.ID,
		Type:      "create",
		Detail:    fmt.Sprintf("购买订单 %s 自动生成（套餐：%s，金额：%.2f）", order.OrderNo, plan.Name, order.Amount),
	})

	// 更新订单
	now := time.Now()
	if err := tx.Model(&order).Updates(map[string]any{
		"status":     models.OrderPaid,
		"paid_at":    now,
		"trade_no":   tradeNo,
		"license_id": license.ID,
	}).Error; err != nil {
		tx.Rollback()
		return nil, false, err
	}
	order.LicenseID = &license.ID
	order.Status = models.OrderPaid
	order.PaidAt = &now
	order.TradeNo = tradeNo

	if err := tx.Commit().Error; err != nil {
		return nil, false, err
	}
	slog.Info("[支付] 订单入账并生成授权码", "orderNo", order.OrderNo, "licenseId", license.ID, "code", code)
	return &order, true, nil
}
