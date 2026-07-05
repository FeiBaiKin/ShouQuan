package service

import (
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"net/smtp"
	"strings"

	"gorm.io/gorm"

	"authcenter/backend/internal/config"
	"authcenter/backend/internal/models"
)

// EmailConfig 邮件配置（settings 表优先，config.yaml 兜底）
type EmailConfig struct {
	SMTPHost string
	SMTPPort int
	SMTPUser string
	SMTPPass string
	FromName string
}

// GetEmailConfig 从 settings 表读取邮件配置，缺失项用 config.yaml 兜底。
func GetEmailConfig(db *gorm.DB, fallback config.SMTPConfig) EmailConfig {
	cfg := EmailConfig{
		SMTPHost: fallback.Host,
		SMTPPort: fallback.Port,
		SMTPUser: fallback.User,
		SMTPPass: fallback.Password,
		FromName: fallback.FromName,
	}
	if cfg.SMTPPort == 0 {
		cfg.SMTPPort = 465
	}
	if cfg.FromName == "" {
		cfg.FromName = "授权中心"
	}

	var rows []models.Setting
	db.Where("setting_key LIKE ?", "email_%").Find(&rows)
	for _, r := range rows {
		switch r.Key {
		case "email_smtp_host":
			if r.Value != "" {
				cfg.SMTPHost = r.Value
			}
		case "email_smtp_port":
			if r.Value != "" {
				fmt.Sscanf(r.Value, "%d", &cfg.SMTPPort)
			}
		case "email_smtp_user":
			if r.Value != "" {
				cfg.SMTPUser = r.Value
			}
		case "email_smtp_pass":
			if r.Value != "" {
				cfg.SMTPPass = r.Value
			}
		case "email_from_name":
			if r.Value != "" {
				cfg.FromName = r.Value
			}
		}
	}
	return cfg
}

// Configured 是否已配置可发信
func (c EmailConfig) Configured() bool {
	return c.SMTPHost != "" && c.SMTPUser != ""
}

// SendLicenseEmail 发送授权码邮件。
// productName: 产品名；licenseCode: 授权码；expiresHint: 有效期说明（如「一年」「永久」）。
func SendLicenseEmail(cfg EmailConfig, to, productName, licenseCode, expiresHint string) error {
	subject := fmt.Sprintf("您的 %s 授权码", productName)
	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>%s</title>
  <style>
    body { margin:0; padding:0; background:#f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .container { max-width:520px; margin:40px auto; background:#ffffff; border:1px solid #e5e5e5; }
    .header { padding:28px 32px 0; }
    .header h2 { margin:0; font-size:18px; font-weight:600; color:#0a0a0a; }
    .body { padding:20px 32px 32px; }
    .meta { font-size:14px; color:#555; line-height:1.7; }
    .code-box { background:#f9f9f9; border:1px solid #e5e5e5; padding:24px; text-align:center; margin:20px 0; border-radius:6px; }
    .code { font-family: 'JetBrains Mono', 'Courier New', monospace; font-size:26px; font-weight:700; letter-spacing:3px; color:#0a0a0a; }
    .tip { font-size:13px; color:#888; line-height:1.6; margin-top:16px; }
    .footer { padding:16px 32px; border-top:1px solid #f0f0f0; font-size:12px; color:#aaa; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>%s 授权码</h2>
    </div>
    <div class="body">
      <p class="meta">您好，感谢购买 <strong>%s</strong>。以下是您的授权码：</p>
      <div class="code-box">
        <span class="code">%s</span>
      </div>
      <p class="meta">授权期限：%s</p>
      <p class="tip">请在程序后台「授权设置」中填入此授权码完成激活。激活后将绑定您的域名并开始计算有效期。如未收到激活指引，请保留此邮件，授权码可随时使用。</p>
    </div>
    <div class="footer">
      此邮件由系统自动发送，请勿回复
    </div>
  </div>
</body>
</html>`, subject, cfg.FromName, productName, licenseCode, expiresHint)

	return sendMail(cfg, to, subject, html, "text/html")
}

// SendTestMail 发送测试邮件
func SendTestMail(cfg EmailConfig, to string) error {
	subject := "SMTP 配置测试"
	html := fmt.Sprintf(`<p>这是一封测试邮件，来自 %s。</p><p>如果您收到此邮件，说明 SMTP 配置正确。</p>`, cfg.FromName)
	return sendMail(cfg, to, subject, html, "text/html")
}

// sendMail 统一邮件发送入口：构造 MIME 报文并按端口选择 SSL 直连（465）或 STARTTLS（587 等）。
func sendMail(cfg EmailConfig, to, subject, body, contentType string) error {
	if !cfg.Configured() {
		return fmt.Errorf("SMTP 未配置")
	}
	headers := fmt.Sprintf("From: %s <%s>\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: %s; charset=UTF-8\r\n\r\n",
		cfg.FromName, cfg.SMTPUser, to, encodeHeader(subject), contentType)
	msg := []byte(headers + body)

	var auth smtp.Auth
	if cfg.SMTPPass != "" {
		if cfg.SMTPPort == 465 {
			// 465 为隐式 TLS，连接已加密，需用不校验 server.TLS 的自定义认证器
			auth = &plainAuth{username: cfg.SMTPUser, password: cfg.SMTPPass}
		} else {
			auth = smtp.PlainAuth("", cfg.SMTPUser, cfg.SMTPPass, cfg.SMTPHost)
		}
	}
	if cfg.SMTPPort == 465 {
		return sendMailSSL(cfg.SMTPHost, cfg.SMTPPort, auth, cfg.SMTPUser, []string{to}, msg)
	}
	addr := fmt.Sprintf("%s:%d", cfg.SMTPHost, cfg.SMTPPort)
	return smtp.SendMail(addr, auth, cfg.SMTPUser, []string{to}, msg)
}

// plainAuth 实现 SASL PLAIN 认证，但不做 net/smtp PlainAuth 的「未加密连接即拒绝」校验。
// 用于 465 隐式 TLS：底层已是 TLS 加密连接，但 smtp.NewClient 不会把 server.TLS 置真，
// 标准库 PlainAuth 会误报 ErrUnencrypted，故此处自行实现。
type plainAuth struct{ username, password string }

func (a *plainAuth) Start(server *smtp.ServerInfo) (string, []byte, error) {
	return "PLAIN", []byte("\x00" + a.username + "\x00" + a.password), nil
}

func (a *plainAuth) Next(fromServer []byte, more bool) ([]byte, error) {
	if more {
		return nil, fmt.Errorf("unexpected server challenge")
	}
	return nil, nil
}

// sendMailSSL SMTP 隐式 TLS 直连（端口 465）。
// net/smtp 未原生支持 465，需先用 tls.Dial 建立 TLS 连接，再在其上跑 SMTP 会话。
func sendMailSSL(host string, port int, auth smtp.Auth, from string, to []string, msg []byte) error {
	addr := fmt.Sprintf("%s:%d", host, port)
	conn, err := tls.Dial("tcp", addr, &tls.Config{ServerName: host})
	if err != nil {
		return fmt.Errorf("SMTP SSL 连接失败: %w", err)
	}
	defer conn.Close()

	c, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("SMTP 客户端创建失败: %w", err)
	}
	defer c.Quit()

	if auth != nil {
		if err := c.Auth(auth); err != nil {
			return fmt.Errorf("SMTP 认证失败: %w", err)
		}
	}
	if err := c.Mail(from); err != nil {
		return err
	}
	for _, rcpt := range to {
		if err := c.Rcpt(rcpt); err != nil {
			return err
		}
	}
	w, err := c.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write(msg); err != nil {
		return err
	}
	return w.Close()
}

// encodeHeader 将含非 ASCII（如中文）的邮件头字段编码为 RFC 2047 B 编码，
// 避免裸 UTF-8 头被部分 MTA 拒收。
func encodeHeader(s string) string {
	if isASCII(s) {
		return s
	}
	return "=?UTF-8?B?" + base64.StdEncoding.EncodeToString([]byte(s)) + "?="
}

func isASCII(s string) bool {
	for i := 0; i < len(s); i++ {
		if s[i] > 127 {
			return false
		}
	}
	return true
}

// FormatExpiresHint 根据期限类型生成中文有效期说明
func FormatExpiresHint(durationType string, durationDays int) string {
	switch durationType {
	case models.DurationPermanent:
		return "永久授权"
	case models.DurationYearly:
		return "一年（365 天），激活后起算"
	case models.DurationCustom:
		return fmt.Sprintf("%d 天，激活后起算", durationDays)
	}
	return strings.TrimSpace(durationType)
}
