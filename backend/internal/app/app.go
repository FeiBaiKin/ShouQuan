package app

import (
	"strconv"
	"sync"
	"time"

	"gorm.io/gorm"

	"authcenter/backend/internal/config"
	"authcenter/backend/internal/models"
	"authcenter/backend/internal/service"
	"authcenter/backend/internal/service/payment"
)

// App 依赖容器，经 gin.Context key "app" 注入 handler
type App struct {
	DB  *gorm.DB
	Cfg *config.Config

	settingsMu   sync.Mutex
	settingsAt   time.Time
	settingsData map[string]string

	payCfgMu   sync.Mutex
	payCfgData *payment.PaymentConfig
	payCfgAt   time.Time

	emailCfgMu   sync.Mutex
	emailCfgData *service.EmailConfig
	emailCfgAt   time.Time
}

func New(db *gorm.DB, cfg *config.Config) *App {
	return &App{DB: db, Cfg: cfg}
}

// Settings 读取全部设置（60s 缓存；后台保存设置时调用 InvalidateSettings）
func (a *App) Settings() map[string]string {
	a.settingsMu.Lock()
	defer a.settingsMu.Unlock()
	if a.settingsData != nil && time.Since(a.settingsAt) < time.Minute {
		return a.settingsData
	}
	var rows []models.Setting
	if err := a.DB.Find(&rows).Error; err != nil {
		if a.settingsData != nil {
			return a.settingsData
		}
		return map[string]string{}
	}
	data := make(map[string]string, len(rows))
	for _, r := range rows {
		data[r.Key] = r.Value
	}
	a.settingsData = data
	a.settingsAt = time.Now()
	return data
}

func (a *App) InvalidateSettings() {
	a.settingsMu.Lock()
	a.settingsData = nil
	a.settingsMu.Unlock()
	a.InvalidatePaymentConfig()
	a.InvalidateEmailConfig()
}

func (a *App) SettingInt(key string, fallback int) int {
	if v, ok := a.Settings()[key]; ok {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return fallback
}

func (a *App) HeartbeatIntervalHours() int {
	return a.SettingInt(models.SettingHeartbeatIntervalHours, 6)
}

func (a *App) GracePeriodDays() int {
	return a.SettingInt(models.SettingGracePeriodDays, 7)
}

// PaymentConfig 读取支付配置（5min 缓存；后台保存支付配置时调用 InvalidatePaymentConfig）
func (a *App) PaymentConfig() payment.PaymentConfig {
	a.payCfgMu.Lock()
	defer a.payCfgMu.Unlock()
	if a.payCfgData != nil && time.Since(a.payCfgAt) < 5*time.Minute {
		return *a.payCfgData
	}
	cfg := payment.GetPaymentConfig(a.DB, a.Cfg.Site.BaseURL)
	a.payCfgData = &cfg
	a.payCfgAt = time.Now()
	return cfg
}

func (a *App) InvalidatePaymentConfig() {
	a.payCfgMu.Lock()
	a.payCfgData = nil
	a.payCfgMu.Unlock()
}

// EmailConfig 读取邮件配置（5min 缓存；后台保存邮件配置时调用 InvalidateEmailConfig）
func (a *App) EmailConfig() service.EmailConfig {
	a.emailCfgMu.Lock()
	defer a.emailCfgMu.Unlock()
	if a.emailCfgData != nil && time.Since(a.emailCfgAt) < 5*time.Minute {
		return *a.emailCfgData
	}
	cfg := service.GetEmailConfig(a.DB, a.Cfg.SMTP)
	a.emailCfgData = &cfg
	a.emailCfgAt = time.Now()
	return cfg
}

func (a *App) InvalidateEmailConfig() {
	a.emailCfgMu.Lock()
	a.emailCfgData = nil
	a.emailCfgMu.Unlock()
}

// SiteName 站点名称（settings 优先，config.yaml 兜底）
func (a *App) SiteName() string {
	if v, ok := a.Settings()["site_name"]; ok && v != "" {
		return v
	}
	if a.Cfg.Site.Name != "" {
		return a.Cfg.Site.Name
	}
	return "授权中心"
}
