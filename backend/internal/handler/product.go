package handler

import (
	"net/http"
	"regexp"

	"github.com/gin-gonic/gin"

	"authcenter/backend/internal/models"
	"authcenter/backend/internal/util"
)

var slugPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{1,62}[a-z0-9]$`)

type productPayload struct {
	Name   string `json:"name" binding:"required"`
	Slug   string `json:"slug" binding:"required"`
	Remark string `json:"remark"`
}

// ListProducts GET /api/admin/products
func ListProducts(c *gin.Context) {
	a := getApp(c)
	var products []models.Product
	if err := a.DB.Order("id ASC").Find(&products).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}
	// 附带统计
	type row struct {
		models.Product
		LicenseCount  int64  `json:"license_count"`
		ReleaseCount  int64  `json:"release_count"`
		LatestVersion string `json:"latest_version"`
	}
	result := make([]row, 0, len(products))
	for _, p := range products {
		r := row{Product: p}
		a.DB.Model(&models.License{}).Where("product_id = ?", p.ID).Count(&r.LicenseCount)
		a.DB.Model(&models.Release{}).Where("product_id = ?", p.ID).Count(&r.ReleaseCount)
		if latest := latestPublishedRelease(a, p.ID); latest != nil {
			r.LatestVersion = latest.Version
		}
		result = append(result, r)
	}
	c.JSON(http.StatusOK, result)
}

// CreateProduct POST /api/admin/products
func CreateProduct(c *gin.Context) {
	a := getApp(c)
	var req productPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请填写产品名称和标识"})
		return
	}
	if !slugPattern.MatchString(req.Slug) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "产品标识需为 3-64 位小写字母/数字/中划线"})
		return
	}
	var count int64
	a.DB.Model(&models.Product{}).Where("slug = ?", req.Slug).Count(&count)
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "产品标识已存在"})
		return
	}
	pub, priv, err := util.GenerateKeyPair()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成密钥对失败"})
		return
	}
	p := models.Product{Name: req.Name, Slug: req.Slug, Remark: req.Remark, PublicKey: pub, PrivateKey: priv}
	if err := a.DB.Create(&p).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建失败"})
		return
	}
	c.JSON(http.StatusOK, p)
}

// UpdateProduct PUT /api/admin/products/:id （slug 与密钥不可改，避免破坏已接入实例）
func UpdateProduct(c *gin.Context) {
	a := getApp(c)
	var p models.Product
	if err := a.DB.First(&p, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "产品不存在"})
		return
	}
	var req struct {
		Name   string `json:"name" binding:"required"`
		Remark string `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请填写产品名称"})
		return
	}
	p.Name, p.Remark = req.Name, req.Remark
	if err := a.DB.Save(&p).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存失败"})
		return
	}
	c.JSON(http.StatusOK, p)
}

// DeleteProduct DELETE /api/admin/products/:id
func DeleteProduct(c *gin.Context) {
	a := getApp(c)
	var p models.Product
	if err := a.DB.First(&p, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "产品不存在"})
		return
	}
	var licenses, releases int64
	a.DB.Model(&models.License{}).Where("product_id = ?", p.ID).Count(&licenses)
	a.DB.Model(&models.Release{}).Where("product_id = ?", p.ID).Count(&releases)
	if licenses > 0 || releases > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "该产品下仍有授权或版本，请先清理后再删除"})
		return
	}
	if err := a.DB.Delete(&p).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "已删除"})
}
