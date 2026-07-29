package handler

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"authcenter/backend/internal/models"
	"authcenter/backend/internal/service"
)

const secretMask = "********"

// 支付配置 key 白名单（写入 settings 表时只允许这些 key）
var paymentConfigKeys = map[string]bool{
	"payment_site_url":          true,
	"payment_enabled_providers": true,
	// 微信
	"payment_wx_appid":               true,
	"payment_wx_mchid":               true,
	"payment_wx_serial_no":           true,
	"payment_wx_api_v3_key":          true,
	"payment_wx_private_key":         true,
	"payment_wx_platform_serial_no":  true,
	"payment_wx_platform_public_key": true,
	"payment_wx_notify_url":          true,
	// 支付宝
	"payment_ali_appid":       true,
	"payment_ali_private_key": true,
	"payment_ali_public_key":  true,
	"payment_ali_scene":       true,
	"payment_ali_notify_url":  true,
	"payment_ali_return_url":  true,
}

// 邮件配置 key 白名单
var emailConfigKeys = map[string]bool{
	"email_smtp_host": true,
	"email_smtp_port": true,
	"email_smtp_user": true,
	"email_smtp_pass": true,
	"email_from_name": true,
}

// 站点配置 key 白名单
var siteConfigKeys = map[string]bool{
	"site_name": true,
}

// 联系方式配置 key 白名单（*_qr 为二维码图片，存 base64 data URL；留空的项前台不展示）
var contactConfigKeys = map[string]bool{
	"contact_qq":          true,
	"contact_qq_qr":       true,
	"contact_qq_group":    true,
	"contact_qq_group_qr": true,
	"contact_wechat":      true,
	"contact_wechat_qr":   true,
	"contact_email":       true,
}

// 二维码 data URL 最大长度（约对应 500KB 图片的 base64）
const contactQRMaxLen = 1 << 20

var secretConfigKeys = map[string]bool{
	"payment_wx_api_v3_key":   true,
	"payment_wx_private_key":  true,
	"payment_ali_private_key": true,
	"email_smtp_pass":         true,
}

// PaymentConfigGet GET /api/admin/payment-config
// 返回支付配置 + 邮件配置 + 站点配置（合并返回，前端分块展示）
func PaymentConfigGet(c *gin.Context) {
	a := getApp(c)
	settings := a.Settings()

	paymentCfg := map[string]string{}
	emailCfg := map[string]string{}
	siteCfg := map[string]string{}
	contactCfg := map[string]string{}
	for k, v := range settings {
		if paymentConfigKeys[k] {
			if secretConfigKeys[k] && v != "" {
				v = secretMask
			}
			paymentCfg[k] = v
		} else if emailConfigKeys[k] {
			if secretConfigKeys[k] && v != "" {
				v = secretMask
			}
			emailCfg[k] = v
		} else if siteConfigKeys[k] {
			siteCfg[k] = v
		} else if contactConfigKeys[k] {
			contactCfg[k] = v
		}
	}
	// 站点名兜底
	if siteCfg["site_name"] == "" {
		siteCfg["site_name"] = a.Cfg.Site.Name
	}
	c.JSON(http.StatusOK, gin.H{
		"payment": paymentCfg,
		"email":   emailCfg,
		"site":    siteCfg,
		"contact": contactCfg,
	})
}

// PaymentConfigPut PUT /api/admin/payment-config
// 接收 {payment: {}, email: {}, site: {}}，按白名单写入 settings 表
func PaymentConfigPut(c *gin.Context) {
	a := getApp(c)
	var req struct {
		Payment map[string]string `json:"payment"`
		Email   map[string]string `json:"email"`
		Site    map[string]string `json:"site"`
		Contact map[string]string `json:"contact"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}
	// 合并所有要更新的 KV，按白名单过滤
	updates := map[string]string{}
	for k, v := range req.Payment {
		if paymentConfigKeys[k] {
			if secretConfigKeys[k] && v == secretMask {
				continue
			}
			updates[k] = v
		}
	}
	for k, v := range req.Email {
		if emailConfigKeys[k] {
			if secretConfigKeys[k] && v == secretMask {
				continue
			}
			updates[k] = v
		}
	}
	for k, v := range req.Site {
		if siteConfigKeys[k] {
			updates[k] = v
		}
	}
	for k, v := range req.Contact {
		if !contactConfigKeys[k] {
			continue
		}
		v = strings.TrimSpace(v)
		if strings.HasSuffix(k, "_qr") {
			if v != "" && !strings.HasPrefix(v, "data:image/") {
				c.JSON(http.StatusBadRequest, gin.H{"error": "二维码需为图片文件"})
				return
			}
			if len(v) > contactQRMaxLen {
				c.JSON(http.StatusBadRequest, gin.H{"error": "二维码图片过大，请压缩到 500KB 以内"})
				return
			}
		} else if len(v) > 200 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "联系方式内容过长"})
			return
		}
		updates[k] = v
	}
	// upsert
	for k, v := range updates {
		var s models.Setting
		if err := a.DB.Where("setting_key = ?", k).First(&s).Error; err != nil {
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "保存失败"})
				return
			}
			if err := a.DB.Create(&models.Setting{Key: k, Value: v}).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "保存失败"})
				return
			}
		} else {
			if err := a.DB.Model(&s).Update("value", v).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "保存失败"})
				return
			}
		}
	}
	a.InvalidateSettings()
	c.JSON(http.StatusOK, gin.H{"message": "已保存"})
}

// PaymentConfigTestEmail POST /api/admin/payment-config/test-email
// 用当前保存的邮件配置发送测试邮件到指定邮箱
func PaymentConfigTestEmail(c *gin.Context) {
	a := getApp(c)
	var req struct {
		To string `json:"to" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请填写收件邮箱"})
		return
	}
	emailCfg := a.EmailConfig()
	if !emailCfg.Configured() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SMTP 未配置"})
		return
	}
	if err := service.SendTestMail(emailCfg, req.To); err != nil {
		slog.Error("[后台] 测试邮件发送失败", "to", req.To, "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "发送失败：" + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "测试邮件已发送"})
}
