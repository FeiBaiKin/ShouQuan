package handler

import (
	"github.com/gin-gonic/gin"

	"authcenter/backend/internal/app"
)

const appKey = "app"

// InjectApp 将依赖容器塞入请求上下文
func InjectApp(a *app.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set(appKey, a)
		c.Next()
	}
}

func getApp(c *gin.Context) *app.App {
	return c.MustGet(appKey).(*app.App)
}
