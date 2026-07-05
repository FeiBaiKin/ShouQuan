package middleware

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"authcenter/backend/internal/models"
	"authcenter/backend/internal/util"
)

// AdminAuth 管理后台鉴权：Authorization: Bearer <JWT>
func AdminAuth(jwtSecret string, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
			return
		}
		claims, err := util.ParseAdminToken(jwtSecret, strings.TrimPrefix(header, "Bearer "))
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "登录已失效"})
			return
		}
		var admin models.Admin
		if err := db.First(&admin, claims.AdminID).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "账号不存在"})
			return
		}
		if admin.MustChangePassword && c.Request.URL.Path != "/api/admin/profile" && c.Request.URL.Path != "/api/admin/password" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "首次登录请先修改密码", "must_change_password": true})
			return
		}
		c.Set("adminID", admin.ID)
		c.Set("adminUsername", admin.Username)
		c.Set("mustChangePassword", admin.MustChangePassword)
		c.Next()
	}
}

// CORS 白名单跨域（空白名单 = 同源部署，直接放行同源即可，不下发跨域头）
func CORS(allowed []string) gin.HandlerFunc {
	allowedSet := make(map[string]bool, len(allowed))
	for _, o := range allowed {
		allowedSet[strings.TrimSuffix(strings.ToLower(o), "/")] = true
	}
	return func(c *gin.Context) {
		origin := strings.ToLower(c.GetHeader("Origin"))
		if origin != "" && allowedSet[origin] {
			c.Header("Access-Control-Allow-Origin", c.GetHeader("Origin"))
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Order-Token")
			c.Header("Access-Control-Max-Age", "86400")
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

// ---- 内存滑动窗口限流（单实例） ----

type rateLimiter struct {
	mu      sync.Mutex
	records map[string][]time.Time
}

var limiter = &rateLimiter{records: make(map[string][]time.Time)}

// RateLimit 按客户端 IP + bucket 限流：window 内最多 limit 次
func RateLimit(bucket string, limit int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := bucket + "|" + clientIP(c)
		now := time.Now()

		limiter.mu.Lock()
		times := limiter.records[key]
		valid := times[:0]
		for _, t := range times {
			if now.Sub(t) < window {
				valid = append(valid, t)
			}
		}
		if len(valid) >= limit {
			limiter.records[key] = valid
			limiter.mu.Unlock()
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "请求过于频繁，请稍后再试"})
			return
		}
		limiter.records[key] = append(valid, now)
		// 顺手清理过大 map（低频触发）
		if len(limiter.records) > 100000 {
			limiter.records = make(map[string][]time.Time)
		}
		limiter.mu.Unlock()
		c.Next()
	}
}

func clientIP(c *gin.Context) string {
	if xff := c.GetHeader("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xr := c.GetHeader("X-Real-IP"); xr != "" {
		return xr
	}
	return c.ClientIP()
}
