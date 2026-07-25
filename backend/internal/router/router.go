package router

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"authcenter/backend/internal/app"
	"authcenter/backend/internal/config"
	"authcenter/backend/internal/handler"
	"authcenter/backend/internal/middleware"
)

func Setup(a *app.App) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	r.MaxMultipartMemory = 64 << 20 // 64MB 内存缓冲，大文件落盘

	r.Use(middleware.CORS(a.Cfg.Server.AllowedOrigins))
	r.Use(handler.InjectApp(a))

	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// ---- 对外接入 API ----
	v1 := r.Group("/api/v1")
	{
		v1.POST("/activate", middleware.RateLimit("activate", 10, time.Minute), handler.Activate)
		v1.POST("/heartbeat", middleware.RateLimit("heartbeat", 60, time.Minute), handler.Heartbeat)
		v1.POST("/upgrade/request", middleware.RateLimit("upgrade", 10, time.Minute), handler.RequestUpgrade)
		v1.GET("/download/:token", middleware.RateLimit("download", 20, time.Minute), handler.Download)
	}

	// ---- 前台公开 API（无需登录） ----
	storefront := r.Group("/api/storefront", middleware.RateLimit("storefront", 60, time.Minute))
	{
		storefront.GET("/products", handler.StorefrontListProducts)
		storefront.GET("/products/:slug", handler.StorefrontGetProduct)
		storefront.GET("/payment-methods", handler.StorefrontPaymentMethods)
		storefront.POST("/orders", handler.StorefrontCreateOrder)
		storefront.GET("/orders/:orderNo", handler.StorefrontOrderStatus)
		storefront.GET("/orders/:orderNo/download", handler.StorefrontDownloadRelease)
		storefront.POST("/orders/:orderNo/resend-email", handler.StorefrontResendEmail)
	}

	// ---- 支付回调（公开） ----
	pay := r.Group("/api/payment/callback")
	{
		pay.POST("/wechat", handler.PaymentCallbackWechat)
		pay.POST("/alipay", handler.PaymentCallbackAlipay)
		pay.GET("/alipay", handler.PaymentCallbackAlipayReturn)
	}

	// ---- 管理后台 API ----
	admin := r.Group("/api/admin")
	{
		admin.POST("/login", middleware.RateLimit("login", 10, time.Minute), handler.AdminLogin)

		authed := admin.Group("", middleware.AdminAuth(a.Cfg.JWT.Secret, a.DB))
		{
			authed.GET("/profile", handler.AdminProfile)
			authed.PUT("/password", handler.ChangePassword)
			authed.GET("/dashboard", handler.Dashboard)

			authed.GET("/products", handler.ListProducts)
			authed.POST("/products", handler.CreateProduct)
			authed.PUT("/products/:id", handler.UpdateProduct)
			authed.DELETE("/products/:id", handler.DeleteProduct)

			authed.GET("/plans", handler.ListPlans)
			authed.POST("/plans", handler.CreatePlan)
			authed.PUT("/plans/:id", handler.UpdatePlan)
			authed.DELETE("/plans/:id", handler.DeletePlan)

			authed.GET("/licenses", handler.ListLicenses)
			authed.POST("/licenses", handler.CreateLicenses)
			authed.GET("/licenses/:id", handler.GetLicense)
			authed.PUT("/licenses/:id", handler.UpdateLicense)
			authed.POST("/licenses/:id/renew", handler.RenewLicense)
			authed.POST("/licenses/:id/rebind", handler.RebindLicense)
			authed.POST("/licenses/:id/revoke", handler.RevokeLicense)
			authed.POST("/licenses/:id/restore", handler.RestoreLicense)
			authed.POST("/licenses/:id/reset", handler.ResetLicense)
			authed.DELETE("/licenses/:id", handler.DeleteLicense)

			authed.GET("/orders", handler.ListOrders)
			authed.GET("/orders/stats", handler.OrderStats)
			authed.GET("/orders/:id", handler.GetOrder)

			authed.GET("/releases", handler.ListReleases)
			authed.POST("/releases", handler.UploadRelease)
			authed.PUT("/releases/:id", handler.UpdateRelease)
			authed.POST("/releases/:id/publish", handler.PublishRelease(true))
			authed.POST("/releases/:id/unpublish", handler.PublishRelease(false))
			authed.DELETE("/releases/:id", handler.DeleteRelease)

			authed.GET("/payment-config", handler.PaymentConfigGet)
			authed.PUT("/payment-config", handler.PaymentConfigPut)
			authed.POST("/payment-config/test-email", handler.PaymentConfigTestEmail)

			authed.GET("/settings", handler.GetSettings)
			authed.PUT("/settings", handler.UpdateSettings)
		}
	}

	setupStatic(r)
	return r
}

// setupStatic 服务前端构建产物：优先 backend/public/，回退 ../frontend/out/。
// 单一 Next 静态导出应用（前台 + /admin 后台同在其中）：
//   public/ = index.html / buy.html / admin.html / admin/login.html ... + _next/
// 命中顺序：精确文件 → <path>.html（干净 URL）→ SPA 壳 index.html。
func setupStatic(r *gin.Engine) {
	root := config.BackendRoot()
	staticDir := filepath.Join(root, "public")
	if _, err := os.Stat(staticDir); os.IsNotExist(err) {
		alt := filepath.Join(root, "..", "frontend", "out")
		if _, err := os.Stat(alt); err == nil {
			staticDir = alt
		}
	}
	indexPath := filepath.Join(staticDir, "index.html")

	fileExists := func(p string) bool {
		info, err := os.Stat(p)
		return err == nil && !info.IsDir()
	}

	r.NoRoute(func(c *gin.Context) {
		reqPath := c.Request.URL.Path
		if c.Request.Method != http.MethodGet || strings.HasPrefix(reqPath, "/api") {
			c.JSON(http.StatusNotFound, gin.H{"error": "接口不存在"})
			return
		}
		clean := filepath.Clean("/" + reqPath)
		// 1) 精确命中静态文件（_next/、screenshots/ 等）
		if f := filepath.Join(staticDir, clean); fileExists(f) {
			c.File(f)
			return
		}
		// 2) 干净 URL：尝试 <path>.html（Next 静态导出每路由一个 html）
		if clean != "/" && !strings.HasSuffix(clean, ".html") {
			if f := filepath.Join(staticDir, clean+".html"); fileExists(f) {
				c.File(f)
				return
			}
		}
		// 3) SPA 壳兜底
		if fileExists(indexPath) {
			c.File(indexPath)
			return
		}
		c.String(http.StatusNotFound, "前端资源未构建")
	})
}
