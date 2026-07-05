package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"authcenter/backend/internal/app"
	"authcenter/backend/internal/config"
	"authcenter/backend/internal/database"
	"authcenter/backend/internal/models"
	"authcenter/backend/internal/router"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("[启动失败] %v", err)
	}

	db, err := database.Init(cfg)
	if err != nil {
		log.Fatalf("[启动失败] %v", err)
	}

	if err := os.MkdirAll(cfg.ReleaseDir, 0o755); err != nil {
		log.Fatalf("[启动失败] 创建更新包目录失败: %v", err)
	}

	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	a := app.New(db, cfg)
	engine := router.Setup(a)

	// 每日清理：过期下载令牌 + 90 天前心跳日志
	cleanupStop := make(chan struct{})
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		cleanup := func() {
			db.Where("expires_at < ?", time.Now().Add(-24*time.Hour)).Delete(&models.DownloadToken{})
			db.Where("created_at < ?", time.Now().AddDate(0, 0, -90)).Delete(&models.HeartbeatLog{})
		}
		cleanup()
		for {
			select {
			case <-ticker.C:
				cleanup()
			case <-cleanupStop:
				return
			}
		}
	}()

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Server.Port),
		Handler: engine,
	}
	go func() {
		log.Printf("授权升级中心已启动：http://localhost:%d", cfg.Server.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("HTTP 服务异常退出: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("正在关闭……")
	close(cleanupStop)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("HTTP 关闭超时: %v", err)
	}
	if sqlDB, err := db.DB(); err == nil {
		_ = sqlDB.Close()
	}
	log.Println("已退出")
}
