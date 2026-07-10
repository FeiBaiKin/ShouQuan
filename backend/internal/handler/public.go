package handler

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"authcenter/backend/internal/app"
	"authcenter/backend/internal/models"
	"authcenter/backend/internal/util"
)

// ---- 请求/响应结构 ----

type publicReq struct {
	Product string `json:"product" binding:"required"`
	Code    string `json:"code" binding:"required"`
	Domain  string `json:"domain" binding:"required"`
	Version string `json:"version"`
}

// UpdateInfo 可用更新信息（仅当有比客户端更新的已发布版本时返回）
type UpdateInfo struct {
	Version   string `json:"version"`
	Changelog string `json:"changelog"`
	FileSize  int64  `json:"file_size"`
	SHA256    string `json:"sha256"`
	Forced    bool   `json:"forced"`
}

// StatusResponse 签名授权状态。Signature 覆盖字段见 util.BuildSignBase，
// 接入方必须用产品公钥验签后才可信任本结构。
type StatusResponse struct {
	Product                string      `json:"product"`
	Code                   string      `json:"code"`
	Domain                 string      `json:"domain"`
	Status                 string      `json:"status"`     // active/expired/revoked/unactivated/domain_mismatch
	ExpiresAt              int64       `json:"expires_at"` // unix 秒；0 = 永久（或未激活）
	Timestamp              int64       `json:"timestamp"`
	LatestVersion          string      `json:"latest_version"`
	SHA256                 string      `json:"sha256"`
	HeartbeatIntervalHours int         `json:"heartbeat_interval_hours"`
	GracePeriodDays        int         `json:"grace_period_days"`
	Signature              string      `json:"signature"`
	Update                 *UpdateInfo `json:"update,omitempty"`
	Message                string      `json:"message,omitempty"`
}

// ---- 公共辅助 ----

func findProductAndLicense(c *gin.Context, a *app.App, req *publicReq) (*models.Product, *models.License, bool) {
	productSlug := strings.ToLower(strings.TrimSpace(req.Product))
	licenseCode := strings.ToUpper(strings.TrimSpace(req.Code))
	var product models.Product
	if err := a.DB.Where("slug = ?", productSlug).First(&product).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "产品不存在"})
		return nil, nil, false
	}
	var license models.License
	if err := a.DB.Where("code = ? AND product_id = ?", licenseCode, product.ID).First(&license).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "授权码不存在"})
		return nil, nil, false
	}
	return &product, &license, true
}

// latestPublishedRelease 返回产品最新已发布版本（semver 最大者），无则返回 nil
func latestPublishedRelease(a *app.App, productID uint) *models.Release {
	var releases []models.Release
	if err := a.DB.Where("product_id = ? AND published = ?", productID, true).Find(&releases).Error; err != nil || len(releases) == 0 {
		return nil
	}
	latest := &releases[0]
	for i := 1; i < len(releases); i++ {
		if util.CompareVersion(releases[i].Version, latest.Version) > 0 {
			latest = &releases[i]
		}
	}
	return latest
}

// signedStatus 构造并签名授权状态响应
func signedStatus(a *app.App, product *models.Product, license *models.License, status, domain string, clientVersion string) (*StatusResponse, error) {
	now := time.Now().Unix()
	var expires int64
	if license.ExpiresAt != nil {
		expires = license.ExpiresAt.Unix()
	}

	latest := latestPublishedRelease(a, product.ID)
	latestVersion, latestSHA := "", ""
	var update *UpdateInfo
	if latest != nil {
		latestVersion, latestSHA = latest.Version, latest.SHA256
		if clientVersion == "" || util.CompareVersion(latest.Version, clientVersion) > 0 {
			update = &UpdateInfo{
				Version:   latest.Version,
				Changelog: latest.Changelog,
				FileSize:  latest.FileSize,
				SHA256:    latest.SHA256,
				Forced:    latest.Forced,
			}
		}
	}

	interval := a.HeartbeatIntervalHours()
	grace := a.GracePeriodDays()
	msg := util.BuildSignBase(product.Slug, license.Code, domain, status, expires, now, latestVersion, latestSHA, interval, grace)
	sig, err := util.SignMessage(product.PrivateKey, msg)
	if err != nil {
		return nil, err
	}
	return &StatusResponse{
		Product:                product.Slug,
		Code:                   license.Code,
		Domain:                 domain,
		Status:                 status,
		ExpiresAt:              expires,
		Timestamp:              now,
		LatestVersion:          latestVersion,
		SHA256:                 latestSHA,
		HeartbeatIntervalHours: interval,
		GracePeriodDays:        grace,
		Signature:              sig,
		Update:                 update,
	}, nil
}

func respondStatus(c *gin.Context, a *app.App, product *models.Product, license *models.License, status, domain, clientVersion, message string) {
	resp, err := signedStatus(a, product, license, status, domain, clientVersion)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "签名失败"})
		return
	}
	resp.Message = message
	c.JSON(http.StatusOK, resp)
}

// ---- 激活 ----

// Activate POST /api/v1/activate
func Activate(c *gin.Context) {
	a := getApp(c)
	var req publicReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数不完整"})
		return
	}
	domain := util.NormalizeDomain(req.Domain)
	if domain == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "域名不合法"})
		return
	}
	product, license, ok := findProductAndLicense(c, a, &req)
	if !ok {
		return
	}

	switch license.Status {
	case models.LicenseRevoked:
		respondStatus(c, a, product, license, models.LicenseRevoked, domain, req.Version, "授权已被吊销")
		return

	case models.LicenseUnactivated:
		now := time.Now()
		license.Domain = domain
		license.ActivatedAt = &now
		license.Status = models.LicenseActive
		license.LastIP = c.ClientIP()
		switch license.DurationType {
		case models.DurationPermanent:
			license.ExpiresAt = nil
		case models.DurationYearly:
			exp := now.AddDate(1, 0, 0)
			license.ExpiresAt = &exp
		default: // custom
			exp := now.AddDate(0, 0, license.DurationDays)
			license.ExpiresAt = &exp
		}
		if err := a.DB.Save(license).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "激活失败"})
			return
		}
		a.DB.Create(&models.LicenseEvent{
			LicenseID: license.ID, Type: "activate",
			Detail: fmt.Sprintf("激活并绑定域名 %s（IP %s）", domain, c.ClientIP()),
		})
		respondStatus(c, a, product, license, models.LicenseActive, domain, req.Version, "激活成功")
		return

	default: // active（含已过期）
		if license.Domain != domain {
			respondStatus(c, a, product, license, "domain_mismatch", domain, req.Version, "该授权码已绑定其他域名")
			return
		}
		// 同域名重复激活（如重装）：幂等返回当前状态
		respondStatus(c, a, product, license, license.EffectiveStatus(), domain, req.Version, "")
		return
	}
}

// ---- 心跳 ----

// Heartbeat POST /api/v1/heartbeat
func Heartbeat(c *gin.Context) {
	a := getApp(c)
	var req publicReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数不完整"})
		return
	}
	domain := util.NormalizeDomain(req.Domain)
	product, license, ok := findProductAndLicense(c, a, &req)
	if !ok {
		return
	}

	status := license.EffectiveStatus()
	if status == models.LicenseActive && license.Domain != domain {
		status = "domain_mismatch"
	}

	// 记录心跳（域名匹配的有效授权才刷新在线状态字段）
	if status == models.LicenseActive || status == models.LicenseExpired {
		if license.Domain == domain {
			now := time.Now()
			a.DB.Model(license).Updates(map[string]any{
				"last_heartbeat_at": now,
				"last_version":      req.Version,
				"last_ip":           c.ClientIP(),
			})
		}
	}
	a.DB.Create(&models.HeartbeatLog{
		LicenseID: license.ID, Domain: domain, Version: req.Version,
		IP: c.ClientIP(), Result: status,
	})

	respondStatus(c, a, product, license, status, domain, req.Version, "")
}

// ---- 升级下载 ----

// RequestUpgrade POST /api/v1/upgrade/request
// 校验授权有效后签发一次性下载令牌（15 分钟）
func RequestUpgrade(c *gin.Context) {
	a := getApp(c)
	var req publicReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数不完整"})
		return
	}
	domain := util.NormalizeDomain(req.Domain)
	product, license, ok := findProductAndLicense(c, a, &req)
	if !ok {
		return
	}

	if license.EffectiveStatus() != models.LicenseActive {
		c.JSON(http.StatusForbidden, gin.H{"error": "授权无效或已过期，无法下载更新"})
		return
	}
	if license.Domain != domain {
		c.JSON(http.StatusForbidden, gin.H{"error": "域名与授权绑定不符"})
		return
	}

	release := latestPublishedRelease(a, product.ID)
	if release == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "暂无可用版本"})
		return
	}

	token, err := util.GenerateToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成下载令牌失败"})
		return
	}
	dt := models.DownloadToken{
		Token: token, ReleaseID: release.ID, LicenseID: license.ID,
		ExpiresAt: time.Now().Add(15 * time.Minute),
	}
	if err := a.DB.Create(&dt).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成下载令牌失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"url":        "/api/v1/download/" + token,
		"token":      token,
		"version":    release.Version,
		"changelog":  release.Changelog,
		"file_size":  release.FileSize,
		"sha256":     release.SHA256,
		"forced":     release.Forced,
		"expires_at": dt.ExpiresAt.Unix(),
	})
}

// Download GET /api/v1/download/:token
func Download(c *gin.Context) {
	a := getApp(c)
	token := c.Param("token")

	var dt models.DownloadToken
	if err := a.DB.Where("token = ?", token).First(&dt).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "下载令牌无效"})
		return
	}
	if dt.UsedAt != nil || time.Now().After(dt.ExpiresAt) {
		c.JSON(http.StatusForbidden, gin.H{"error": "下载令牌已使用或已过期"})
		return
	}

	// 原子标记已使用，防并发复用
	now := time.Now()
	res := a.DB.Model(&models.DownloadToken{}).
		Where("id = ? AND used_at IS NULL", dt.ID).
		Update("used_at", now)
	if res.Error != nil || res.RowsAffected == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "下载令牌已使用"})
		return
	}

	var release models.Release
	if err := a.DB.First(&release, dt.ReleaseID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "版本不存在"})
		return
	}
	path := filepath.Join(a.Cfg.ReleaseDir, release.FileName)
	if _, err := os.Stat(path); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "更新包文件缺失"})
		return
	}

	a.DB.Model(&release).UpdateColumn("downloads", gorm.Expr("downloads + 1"))
	c.FileAttachment(path, release.OriginalName)
}
