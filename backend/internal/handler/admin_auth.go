package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"

	"authcenter/backend/internal/models"
	"authcenter/backend/internal/util"
)

// AdminLogin POST /api/admin/login
func AdminLogin(c *gin.Context) {
	a := getApp(c)
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请输入用户名和密码"})
		return
	}
	var admin models.Admin
	if err := a.DB.Where("username = ?", req.Username).First(&admin).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte(req.Password)) != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}
	token, err := util.GenerateAdminToken(a.Cfg.JWT.Secret, admin.ID, admin.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成会话失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"token":                token,
		"username":             admin.Username,
		"must_change_password": admin.MustChangePassword,
	})
}

// AdminProfile GET /api/admin/profile
func AdminProfile(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"username":             c.GetString("adminUsername"),
		"must_change_password": c.GetBool("mustChangePassword"),
	})
}

// ChangePassword PUT /api/admin/password
func ChangePassword(c *gin.Context) {
	a := getApp(c)
	var req struct {
		OldPassword string `json:"old_password" binding:"required"`
		NewPassword string `json:"new_password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "新密码至少 6 位"})
		return
	}
	adminID := c.GetUint("adminID")
	var admin models.Admin
	if err := a.DB.First(&admin, adminID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "账号不存在"})
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte(req.OldPassword)) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "原密码错误"})
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte(req.NewPassword)) == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "新密码不能与原密码相同"})
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "密码加密失败"})
		return
	}
	if err := a.DB.Model(&admin).Updates(map[string]any{
		"password":             string(hash),
		"must_change_password": false,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "密码已修改"})
}
