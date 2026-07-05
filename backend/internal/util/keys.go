package util

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"strings"
)

// GenerateKeyPair 生成 Ed25519 密钥对，base64 编码返回 (公钥, 私钥)
func GenerateKeyPair() (string, string, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return "", "", err
	}
	return base64.StdEncoding.EncodeToString(pub), base64.StdEncoding.EncodeToString(priv), nil
}

// SignMessage 用 base64 私钥对消息签名，返回 base64 签名
func SignMessage(privB64 string, msg []byte) (string, error) {
	raw, err := base64.StdEncoding.DecodeString(privB64)
	if err != nil {
		return "", fmt.Errorf("私钥解码失败: %w", err)
	}
	if len(raw) != ed25519.PrivateKeySize {
		return "", fmt.Errorf("私钥长度非法")
	}
	sig := ed25519.Sign(ed25519.PrivateKey(raw), msg)
	return base64.StdEncoding.EncodeToString(sig), nil
}

// VerifyMessage 用 base64 公钥验签（接入方 SDK 同款逻辑，服务端测试用）
func VerifyMessage(pubB64 string, msg []byte, sigB64 string) bool {
	pub, err := base64.StdEncoding.DecodeString(pubB64)
	if err != nil || len(pub) != ed25519.PublicKeySize {
		return false
	}
	sig, err := base64.StdEncoding.DecodeString(sigB64)
	if err != nil {
		return false
	}
	return ed25519.Verify(ed25519.PublicKey(pub), msg, sig)
}

// BuildSignBase 构造待签名字符串。字段顺序即协议契约，接入方必须按相同顺序拼接验签：
// product\ncode\ndomain\nstatus\nexpires_at\ntimestamp\nlatest_version\nsha256\nheartbeat_interval_hours\ngrace_period_days
func BuildSignBase(product, code, domain, status string, expiresAt, timestamp int64, latestVersion, sha256 string, intervalHours, graceDays int) []byte {
	return []byte(strings.Join([]string{
		product, code, domain, status,
		fmt.Sprintf("%d", expiresAt),
		fmt.Sprintf("%d", timestamp),
		latestVersion, sha256,
		fmt.Sprintf("%d", intervalHours),
		fmt.Sprintf("%d", graceDays),
	}, "\n"))
}
