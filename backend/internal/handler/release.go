package handler

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"authcenter/backend/internal/models"
)

var versionPattern = regexp.MustCompile(`^[0-9A-Za-z][0-9A-Za-z.\-+]{0,30}$`)

// ListReleases GET /api/admin/releases?product_id=
func ListReleases(c *gin.Context) {
	a := getApp(c)
	query := a.DB.Model(&models.Release{}).Preload("Product")
	if pid := c.Query("product_id"); pid != "" {
		query = query.Where("product_id = ?", pid)
	}
	var releases []models.Release
	if err := query.Order("id DESC").Find(&releases).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}
	c.JSON(http.StatusOK, releases)
}

// UploadRelease POST /api/admin/releases（multipart：product_id/version/changelog/forced/file）
// 上传后默认未发布，需手动点发布
func UploadRelease(c *gin.Context) {
	a := getApp(c)
	productID, _ := strconv.Atoi(c.PostForm("product_id"))
	version := strings.ToLower(strings.TrimSpace(c.PostForm("version")))
	changelog := c.PostForm("changelog")
	forced := c.PostForm("forced") == "true" || c.PostForm("forced") == "1"

	if productID <= 0 || !versionPattern.MatchString(version) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "产品或版本号不合法（版本号仅限字母/数字/./-/+）"})
		return
	}
	var product models.Product
	if err := a.DB.First(&product, productID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "产品不存在"})
		return
	}
	var dup int64
	a.DB.Model(&models.Release{}).Where("product_id = ? AND version = ?", productID, version).Count(&dup)
	if dup > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "该版本号已存在"})
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请选择更新包文件"})
		return
	}

	// 存储路径：release/<slug>/<slug>-<version><ext>
	ext := filepath.Ext(fileHeader.Filename)
	if ext == ".gz" && filepath.Ext(fileHeader.Filename[:len(fileHeader.Filename)-3]) == ".tar" {
		ext = ".tar.gz"
	}
	relName := path.Join(product.Slug, fmt.Sprintf("%s-%s%s", product.Slug, version, ext))
	absPath := filepath.Join(a.Cfg.ReleaseDir, relName)
	if err := os.MkdirAll(filepath.Dir(absPath), 0o755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建存储目录失败"})
		return
	}

	src, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "读取上传文件失败"})
		return
	}
	defer src.Close()
	dst, err := os.Create(absPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "写入文件失败"})
		return
	}
	hasher := sha256.New()
	size, err := io.Copy(io.MultiWriter(dst, hasher), src)
	closeErr := dst.Close()
	if err != nil || closeErr != nil {
		_ = os.Remove(absPath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存文件失败"})
		return
	}

	release := models.Release{
		ProductID:    uint(productID),
		Version:      version,
		Changelog:    changelog,
		FileName:     relName,
		OriginalName: fileHeader.Filename,
		FileSize:     size,
		SHA256:       hex.EncodeToString(hasher.Sum(nil)),
		Forced:       forced,
		Published:    false,
	}
	if err := a.DB.Create(&release).Error; err != nil {
		_ = os.Remove(absPath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存版本记录失败"})
		return
	}
	release.Product = &product
	c.JSON(http.StatusOK, release)
}

// UpdateRelease PUT /api/admin/releases/:id（改 changelog / forced）
func UpdateRelease(c *gin.Context) {
	a := getApp(c)
	var r models.Release
	if err := a.DB.First(&r, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "版本不存在"})
		return
	}
	var req struct {
		Changelog string `json:"changelog"`
		Forced    *bool  `json:"forced"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}
	r.Changelog = req.Changelog
	if req.Forced != nil {
		r.Forced = *req.Forced
	}
	if err := a.DB.Save(&r).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存失败"})
		return
	}
	c.JSON(http.StatusOK, r)
}

// PublishRelease POST /api/admin/releases/:id/publish | /unpublish
func PublishRelease(publish bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		a := getApp(c)
		var r models.Release
		if err := a.DB.First(&r, c.Param("id")).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "版本不存在"})
			return
		}
		if err := a.DB.Model(&r).Update("published", publish).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "操作失败"})
			return
		}
		r.Published = publish
		c.JSON(http.StatusOK, r)
	}
}

// DeleteRelease DELETE /api/admin/releases/:id（连文件一起删）
func DeleteRelease(c *gin.Context) {
	a := getApp(c)
	var r models.Release
	if err := a.DB.First(&r, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "版本不存在"})
		return
	}
	if err := a.DB.Delete(&r).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除失败"})
		return
	}
	a.DB.Where("release_id = ?", r.ID).Delete(&models.DownloadToken{})
	_ = os.Remove(filepath.Join(a.Cfg.ReleaseDir, r.FileName))
	c.JSON(http.StatusOK, gin.H{"message": "已删除"})
}
