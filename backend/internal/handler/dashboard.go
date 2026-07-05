package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"authcenter/backend/internal/models"
)

// Dashboard GET /api/admin/dashboard
func Dashboard(c *gin.Context) {
	a := getApp(c)
	now := time.Now()

	var licenseTotal, licenseActive, licenseExpiring, licenseUnactivated, licenseRevoked, sitesActive int64
	a.DB.Model(&models.License{}).Count(&licenseTotal)
	a.DB.Model(&models.License{}).
		Where("status = ? AND (expires_at IS NULL OR expires_at > ?)", models.LicenseActive, now).
		Count(&licenseActive)
	a.DB.Model(&models.License{}).
		Where("status = ? AND expires_at IS NOT NULL AND expires_at BETWEEN ? AND ?",
			models.LicenseActive, now, now.AddDate(0, 0, 30)).
		Count(&licenseExpiring)
	a.DB.Model(&models.License{}).Where("status = ?", models.LicenseUnactivated).Count(&licenseUnactivated)
	a.DB.Model(&models.License{}).Where("status = ?", models.LicenseRevoked).Count(&licenseRevoked)
	a.DB.Model(&models.License{}).
		Where("last_heartbeat_at IS NOT NULL AND last_heartbeat_at > ?", now.Add(-24*time.Hour)).
		Count(&sitesActive)

	// 各产品概况
	var products []models.Product
	a.DB.Order("id ASC").Find(&products)
	type productStat struct {
		ID            uint   `json:"id"`
		Name          string `json:"name"`
		Slug          string `json:"slug"`
		LicenseCount  int64  `json:"license_count"`
		ActiveCount   int64  `json:"active_count"`
		LatestVersion string `json:"latest_version"`
	}
	productStats := make([]productStat, 0, len(products))
	for _, p := range products {
		ps := productStat{ID: p.ID, Name: p.Name, Slug: p.Slug}
		a.DB.Model(&models.License{}).Where("product_id = ?", p.ID).Count(&ps.LicenseCount)
		a.DB.Model(&models.License{}).
			Where("product_id = ? AND status = ? AND (expires_at IS NULL OR expires_at > ?)", p.ID, models.LicenseActive, now).
			Count(&ps.ActiveCount)
		if latest := latestPublishedRelease(a, p.ID); latest != nil {
			ps.LatestVersion = latest.Version
		}
		productStats = append(productStats, ps)
	}

	// 最近事件（激活/续期/吊销等），带授权码
	type eventRow struct {
		models.LicenseEvent
		Code        string `json:"code"`
		ProductName string `json:"product_name"`
	}
	var events []models.LicenseEvent
	a.DB.Order("id DESC").Limit(10).Find(&events)
	eventRows := make([]eventRow, 0, len(events))
	for _, e := range events {
		row := eventRow{LicenseEvent: e}
		var l models.License
		if err := a.DB.Preload("Product").First(&l, e.LicenseID).Error; err == nil {
			row.Code = l.Code
			if l.Product != nil {
				row.ProductName = l.Product.Name
			}
		}
		eventRows = append(eventRows, row)
	}

	// 即将到期列表（前 10）
	var expiringList []models.License
	a.DB.Preload("Product").
		Where("status = ? AND expires_at IS NOT NULL AND expires_at BETWEEN ? AND ?",
			models.LicenseActive, now, now.AddDate(0, 0, 30)).
		Order("expires_at ASC").Limit(10).Find(&expiringList)
	expiringRows := make([]licenseRow, 0, len(expiringList))
	for _, l := range expiringList {
		expiringRows = append(expiringRows, toLicenseRow(l))
	}

	c.JSON(http.StatusOK, gin.H{
		"license_total":       licenseTotal,
		"license_active":      licenseActive,
		"license_expiring":    licenseExpiring,
		"license_unactivated": licenseUnactivated,
		"license_revoked":     licenseRevoked,
		"sites_active_24h":    sitesActive,
		"products":            productStats,
		"recent_events":       eventRows,
		"expiring_list":       expiringRows,
	})
}

// GetSettings GET /api/admin/settings
func GetSettings(c *gin.Context) {
	a := getApp(c)
	c.JSON(http.StatusOK, gin.H{
		"heartbeat_interval_hours": a.HeartbeatIntervalHours(),
		"grace_period_days":        a.GracePeriodDays(),
	})
}

// UpdateSettings PUT /api/admin/settings
func UpdateSettings(c *gin.Context) {
	a := getApp(c)
	var req struct {
		HeartbeatIntervalHours int `json:"heartbeat_interval_hours" binding:"required,min=1,max=168"`
		GracePeriodDays        int `json:"grace_period_days" binding:"required,min=0,max=90"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "心跳间隔 1-168 小时，宽限期 0-90 天"})
		return
	}
	values := map[string]string{
		models.SettingHeartbeatIntervalHours: strconv.Itoa(req.HeartbeatIntervalHours),
		models.SettingGracePeriodDays:        strconv.Itoa(req.GracePeriodDays),
	}
	for k, v := range values {
		if err := a.DB.Model(&models.Setting{}).Where("setting_key = ?", k).Update("value", v).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "保存失败"})
			return
		}
	}
	a.InvalidateSettings()
	c.JSON(http.StatusOK, gin.H{"message": "已保存"})
}
