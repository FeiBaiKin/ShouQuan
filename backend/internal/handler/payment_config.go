package handler

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"authcenter/backend/internal/models"
	"authcenter/backend/internal/service"
)

// 支付配置 key 白名单（写入 settings 表时只允许这些 key）
var paymentConfigKeys = map[string]bool{
	"payment_site_url":          true,
	"payment_enabled_providers": true,
	// 微信
	"payment_wx_appid":      true,
	"payment_wx_mchid":      true,
	"payment_wx_serial_no":  true,
	"payment_wx_api_v3_key": true,
	"payment_wx_private_key": true,
	"payment_wx_notify_url": true,
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

// PaymentConfigGet GET /api/admin/payment-config
// 返回支付配置 + 邮件配置 + 站点配置（合并返回，前端分块展示）
func PaymentConfigGet(c *gin.Context) {
	a := getApp(c)
	settings := a.Settings()

	paymentCfg := map[string]string{}
	emailCfg := map[string]string{}
	siteCfg := map[string]string{}
	for k, v := range settings {
		if paymentConfigKeys[k] {
			paymentCfg[k] = v
		} else if emailConfigKeys[k] {
			emailCfg[k] = v
		} else if siteConfigKeys[k] {
			siteCfg[k] = v
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
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}
	// 合并所有要更新的 KV，按白名单过滤
	updates := map[string]string{}
	for k, v := range req.Payment {
		if paymentConfigKeys[k] {
			updates[k] = v
		}
	}
	for k, v := range req.Email {
		if emailConfigKeys[k] {
			updates[k] = v
		}
	}
	for k, v := range req.Site {
		if siteConfigKeys[k] {
			updates[k] = v
		}
	}
	// upsert
	for k, v := range updates {
		var s models.Setting
		if err := a.DB.Where("setting_key = ?", k).First(&s).Error; err != nil {
			// 不存在则创建
			a.DB.Create(&models.Setting{Key: k, Value: v})
		} else {
			a.DB.Model(&s).Update("value", v)
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
