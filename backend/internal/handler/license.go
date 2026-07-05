package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"authcenter/backend/internal/models"
	"authcenter/backend/internal/util"
)

type licenseRow struct {
	models.License
	EffectiveStatus string `json:"effective_status"`
	ProductName     string `json:"product_name"`
	ProductSlug     string `json:"product_slug"`
}

func toLicenseRow(l models.License) licenseRow {
	r := licenseRow{License: l, EffectiveStatus: l.EffectiveStatus()}
	if l.Product != nil {
		r.ProductName = l.Product.Name
		r.ProductSlug = l.Product.Slug
	}
	return r
}

// ListLicenses GET /api/admin/licenses?product_id=&status=&q=&page=&page_size=
func ListLicenses(c *gin.Context) {
	a := getApp(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	query := a.DB.Model(&models.License{})
	if pid := c.Query("product_id"); pid != "" {
		query = query.Where("product_id = ?", pid)
	}
	if q := c.Query("q"); q != "" {
		like := "%" + q + "%"
		query = query.Where("code LIKE ? OR customer_name LIKE ? OR customer_contact LIKE ? OR domain LIKE ?", like, like, like, like)
	}
	now := time.Now()
	switch c.Query("status") {
	case models.LicenseActive:
		query = query.Where("status = ? AND (expires_at IS NULL OR expires_at > ?)", models.LicenseActive, now)
	case models.LicenseExpired:
		query = query.Where("status = ? AND expires_at IS NOT NULL AND expires_at <= ?", models.LicenseActive, now)
	case models.LicenseRevoked:
		query = query.Where("status = ?", models.LicenseRevoked)
	case models.LicenseUnactivated:
		query = query.Where("status = ?", models.LicenseUnactivated)
	case "expiring": // 30 天内到期
		query = query.Where("status = ? AND expires_at IS NOT NULL AND expires_at BETWEEN ? AND ?",
			models.LicenseActive, now, now.AddDate(0, 0, 30))
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}
	var licenses []models.License
	if err := query.Preload("Product").Order("id DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&licenses).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}
	rows := make([]licenseRow, 0, len(licenses))
	for _, l := range licenses {
		rows = append(rows, toLicenseRow(l))
	}
	c.JSON(http.StatusOK, gin.H{"total": total, "items": rows, "page": page, "page_size": pageSize})
}

// CreateLicenses POST /api/admin/licenses（count 支持批量 1-100）
func CreateLicenses(c *gin.Context) {
	a := getApp(c)
	var req struct {
		ProductID       uint   `json:"product_id" binding:"required"`
		CustomerName    string `json:"customer_name"`
		CustomerContact string `json:"customer_contact"`
		Remark          string `json:"remark"`
		DurationType    string `json:"duration_type" binding:"required"`
		DurationDays    int    `json:"duration_days"`
		Count           int    `json:"count"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数不完整"})
		return
	}
	switch req.DurationType {
	case models.DurationYearly:
		req.DurationDays = 365
	case models.DurationPermanent:
		req.DurationDays = 0
	case models.DurationCustom:
		if req.DurationDays < 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "自定义期限天数需大于 0"})
			return
		}
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "期限类型不合法"})
		return
	}
	if req.Count < 1 {
		req.Count = 1
	}
	if req.Count > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "单次最多生成 100 个授权"})
		return
	}
	var product models.Product
	if err := a.DB.First(&product, req.ProductID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "产品不存在"})
		return
	}

	created := make([]licenseRow, 0, req.Count)
	for i := 0; i < req.Count; i++ {
		var code string
		// 撞码重试
		for attempt := 0; attempt < 5; attempt++ {
			candidate, err := util.GenerateLicenseCode()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "生成授权码失败"})
				return
			}
			var count int64
			a.DB.Model(&models.License{}).Where("code = ?", candidate).Count(&count)
			if count == 0 {
				code = candidate
				break
			}
		}
		if code == "" {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "生成授权码失败（重复冲突）"})
			return
		}
		l := models.License{
			ProductID:       req.ProductID,
			Code:            code,
			CustomerName:    req.CustomerName,
			CustomerContact: req.CustomerContact,
			Remark:          req.Remark,
			DurationType:    req.DurationType,
			DurationDays:    req.DurationDays,
			Status:          models.LicenseUnactivated,
		}
		if err := a.DB.Create(&l).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "创建失败"})
			return
		}
		a.DB.Create(&models.LicenseEvent{LicenseID: l.ID, Type: "create", Detail: "创建授权"})
		l.Product = &product
		created = append(created, toLicenseRow(l))
	}
	c.JSON(http.StatusOK, gin.H{"items": created})
}

// GetLicense GET /api/admin/licenses/:id（详情 + 事件 + 近 50 条心跳）
func GetLicense(c *gin.Context) {
	a := getApp(c)
	var l models.License
	if err := a.DB.Preload("Product").First(&l, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "授权不存在"})
		return
	}
	var events []models.LicenseEvent
	a.DB.Where("license_id = ?", l.ID).Order("id DESC").Limit(50).Find(&events)
	var heartbeats []models.HeartbeatLog
	a.DB.Where("license_id = ?", l.ID).Order("id DESC").Limit(50).Find(&heartbeats)
	c.JSON(http.StatusOK, gin.H{"license": toLicenseRow(l), "events": events, "heartbeats": heartbeats})
}

// UpdateLicense PUT /api/admin/licenses/:id（仅客户信息/备注）
func UpdateLicense(c *gin.Context) {
	a := getApp(c)
	var l models.License
	if err := a.DB.First(&l, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "授权不存在"})
		return
	}
	var req struct {
		CustomerName    string `json:"customer_name"`
		CustomerContact string `json:"customer_contact"`
		Remark          string `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}
	l.CustomerName, l.CustomerContact, l.Remark = req.CustomerName, req.CustomerContact, req.Remark
	if err := a.DB.Save(&l).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存失败"})
		return
	}
	c.JSON(http.StatusOK, toLicenseRow(l))
}

// RenewLicense POST /api/admin/licenses/:id/renew {days} 或 {permanent: true}
func RenewLicense(c *gin.Context) {
	a := getApp(c)
	var l models.License
	if err := a.DB.First(&l, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "授权不存在"})
		return
	}
	var req struct {
		Days      int  `json:"days"`
		Permanent bool `json:"permanent"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || (!req.Permanent && req.Days < 1) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "续期天数需大于 0"})
		return
	}
	if l.Status == models.LicenseRevoked {
		c.JSON(http.StatusBadRequest, gin.H{"error": "授权已吊销，请先恢复"})
		return
	}
	var detail string
	if req.Permanent {
		l.ExpiresAt = nil
		l.DurationType = models.DurationPermanent
		l.DurationDays = 0
		detail = "转为永久授权"
	} else {
		if l.Status == models.LicenseUnactivated {
			// 未激活：追加到期限天数（激活时起算）
			if l.DurationType == models.DurationPermanent {
				c.JSON(http.StatusBadRequest, gin.H{"error": "永久授权无需续期"})
				return
			}
			l.DurationType = models.DurationCustom
			l.DurationDays += req.Days
			detail = fmt.Sprintf("未激活授权追加 %d 天（激活时起算，共 %d 天）", req.Days, l.DurationDays)
		} else {
			if l.ExpiresAt == nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "永久授权无需续期"})
				return
			}
			// 已过期从当前时间起算，未过期从原到期日累加
			base := *l.ExpiresAt
			if time.Now().After(base) {
				base = time.Now()
			}
			exp := base.AddDate(0, 0, req.Days)
			l.ExpiresAt = &exp
			detail = fmt.Sprintf("续期 %d 天，新到期时间 %s", req.Days, exp.Format("2006-01-02"))
		}
	}
	if err := a.DB.Save(&l).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存失败"})
		return
	}
	a.DB.Create(&models.LicenseEvent{LicenseID: l.ID, Type: "renew", Detail: detail})
	c.JSON(http.StatusOK, toLicenseRow(l))
}

// RebindLicense POST /api/admin/licenses/:id/rebind {domain}
func RebindLicense(c *gin.Context) {
	a := getApp(c)
	var l models.License
	if err := a.DB.First(&l, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "授权不存在"})
		return
	}
	var req struct {
		Domain string `json:"domain" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请填写新域名"})
		return
	}
	domain := util.NormalizeDomain(req.Domain)
	if domain == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "域名不合法"})
		return
	}
	if l.Status == models.LicenseUnactivated {
		c.JSON(http.StatusBadRequest, gin.H{"error": "授权尚未激活，无需改绑"})
		return
	}
	old := l.Domain
	l.Domain = domain
	if err := a.DB.Save(&l).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存失败"})
		return
	}
	a.DB.Create(&models.LicenseEvent{LicenseID: l.ID, Type: "rebind", Detail: fmt.Sprintf("域名 %s → %s", old, domain)})
	c.JSON(http.StatusOK, toLicenseRow(l))
}

// RevokeLicense POST /api/admin/licenses/:id/revoke
func RevokeLicense(c *gin.Context) {
	a := getApp(c)
	var l models.License
	if err := a.DB.First(&l, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "授权不存在"})
		return
	}
	if l.Status == models.LicenseRevoked {
		c.JSON(http.StatusBadRequest, gin.H{"error": "授权已处于吊销状态"})
		return
	}
	// 记住吊销前状态以便恢复
	prev := l.Status
	l.Status = models.LicenseRevoked
	if err := a.DB.Save(&l).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存失败"})
		return
	}
	a.DB.Create(&models.LicenseEvent{LicenseID: l.ID, Type: "revoke", Detail: "吊销授权（原状态 " + prev + "）"})
	c.JSON(http.StatusOK, toLicenseRow(l))
}

// RestoreLicense POST /api/admin/licenses/:id/restore（吊销恢复）
func RestoreLicense(c *gin.Context) {
	a := getApp(c)
	var l models.License
	if err := a.DB.First(&l, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "授权不存在"})
		return
	}
	if l.Status != models.LicenseRevoked {
		c.JSON(http.StatusBadRequest, gin.H{"error": "授权未被吊销"})
		return
	}
	if l.ActivatedAt != nil {
		l.Status = models.LicenseActive
	} else {
		l.Status = models.LicenseUnactivated
	}
	if err := a.DB.Save(&l).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存失败"})
		return
	}
	a.DB.Create(&models.LicenseEvent{LicenseID: l.ID, Type: "restore", Detail: "恢复授权"})
	c.JSON(http.StatusOK, toLicenseRow(l))
}

// ResetLicense POST /api/admin/licenses/:id/reset（解绑重置为未激活，期限重新计算）
func ResetLicense(c *gin.Context) {
	a := getApp(c)
	var l models.License
	if err := a.DB.First(&l, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "授权不存在"})
		return
	}
	old := l.Domain
	updates := map[string]any{
		"status":            models.LicenseUnactivated,
		"domain":            "",
		"activated_at":      nil,
		"expires_at":        nil,
		"last_heartbeat_at": nil,
		"last_version":      "",
		"last_ip":           "",
	}
	if err := a.DB.Model(&l).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存失败"})
		return
	}
	a.DB.Create(&models.LicenseEvent{LicenseID: l.ID, Type: "reset", Detail: fmt.Sprintf("重置授权（解绑域名 %s，恢复未激活）", old)})
	a.DB.First(&l, l.ID)
	c.JSON(http.StatusOK, toLicenseRow(l))
}

// DeleteLicense DELETE /api/admin/licenses/:id
func DeleteLicense(c *gin.Context) {
	a := getApp(c)
	var l models.License
	if err := a.DB.First(&l, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "授权不存在"})
		return
	}
	if err := a.DB.Delete(&l).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除失败"})
		return
	}
	a.DB.Where("license_id = ?", l.ID).Delete(&models.LicenseEvent{})
	a.DB.Where("license_id = ?", l.ID).Delete(&models.HeartbeatLog{})
	a.DB.Where("license_id = ?", l.ID).Delete(&models.DownloadToken{})
	c.JSON(http.StatusOK, gin.H{"message": "已删除"})
}
