package config

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/spf13/viper"
)

type ServerConfig struct {
	Port           int      `mapstructure:"port"`
	AllowedOrigins []string `mapstructure:"allowed_origins"`
}

type DatabaseConfig struct {
	Host          string `mapstructure:"host"`
	Port          int    `mapstructure:"port"`
	User          string `mapstructure:"user"`
	Password      string `mapstructure:"password"`
	Name          string `mapstructure:"name"`
	SSLMode       string `mapstructure:"ssl_mode"`
	TimeZone      string `mapstructure:"timezone"`
	MaintenanceDB string `mapstructure:"maintenance_db"`
	AutoCreate    bool   `mapstructure:"auto_create"`
}

var postgresDatabaseNamePattern = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_-]{0,62}$`)

type JWTConfig struct {
	Secret string `mapstructure:"secret"`
}

type AdminConfig struct {
	Username string `mapstructure:"username"`
	Password string `mapstructure:"password"`
}

// SMTPConfig 邮件发送配置（config.yaml 兜底，运行时可被 settings 表覆盖）
type SMTPConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
	FromName string `mapstructure:"from_name"`
}

// SiteConfig 站点级配置
type SiteConfig struct {
	BaseURL string `mapstructure:"base_url"` // 站点公网地址，用于拼接支付回调 URL
	Name    string `mapstructure:"name"`     // 站点名称，用于邮件标题等
}

type Config struct {
	Server     ServerConfig   `mapstructure:"server"`
	Database   DatabaseConfig `mapstructure:"database"`
	JWT        JWTConfig      `mapstructure:"jwt"`
	Admin      AdminConfig    `mapstructure:"admin"`
	SMTP       SMTPConfig     `mapstructure:"smtp"`
	Site       SiteConfig     `mapstructure:"site"`
	ReleaseDir string         `mapstructure:"release_dir"`
}

// BackendRoot 返回 main.go 所在目录（工作目录可能不同，按可执行文件定位并回退工作目录）
func BackendRoot() string {
	if wd, err := os.Getwd(); err == nil {
		if _, err := os.Stat(filepath.Join(wd, "config.yaml")); err == nil {
			return wd
		}
		if _, err := os.Stat(filepath.Join(wd, "config.yaml.example")); err == nil {
			return wd
		}
	}
	if exe, err := os.Executable(); err == nil {
		return filepath.Dir(exe)
	}
	return "."
}

func Load() (*Config, error) {
	root := BackendRoot()
	path := filepath.Join(root, "config.yaml")

	v := viper.New()
	v.SetConfigFile(path)
	v.SetConfigType("yaml")

	v.SetDefault("server.port", 5000)
	v.SetDefault("server.allowed_origins", []string{})
	v.SetDefault("database.host", "127.0.0.1")
	v.SetDefault("database.port", 5432)
	v.SetDefault("database.user", "postgres")
	v.SetDefault("database.name", "authcenter")
	v.SetDefault("database.ssl_mode", "disable")
	v.SetDefault("database.timezone", "Asia/Shanghai")
	v.SetDefault("database.maintenance_db", "postgres")
	v.SetDefault("database.auto_create", true)
	v.SetDefault("admin.username", "admin")
	v.SetDefault("admin.password", "admin123")
	v.SetDefault("smtp.port", 465)
	v.SetDefault("smtp.from_name", "授权中心")
	v.SetDefault("site.name", "授权中心")
	v.SetDefault("release_dir", filepath.Join(root, "release"))

	if _, err := os.Stat(path); os.IsNotExist(err) {
		return nil, fmt.Errorf("配置文件不存在：%s（请复制 config.yaml.example 并填写数据库信息）", path)
	}
	if err := v.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("读取配置失败: %w", err)
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("解析配置失败: %w", err)
	}
	if err := cfg.Database.Validate(); err != nil {
		return nil, fmt.Errorf("PostgreSQL 配置无效: %w", err)
	}

	// JWT secret 缺失时自动生成并写回
	if cfg.JWT.Secret == "" {
		buf := make([]byte, 32)
		if _, err := rand.Read(buf); err != nil {
			return nil, fmt.Errorf("生成 JWT secret 失败: %w", err)
		}
		cfg.JWT.Secret = hex.EncodeToString(buf)
		v.Set("jwt.secret", cfg.JWT.Secret)
		if err := v.WriteConfigAs(path); err != nil {
			return nil, fmt.Errorf("写回 JWT secret 失败: %w", err)
		}
	}

	if !filepath.IsAbs(cfg.ReleaseDir) {
		cfg.ReleaseDir = filepath.Join(root, cfg.ReleaseDir)
	}
	return &cfg, nil
}

func (d DatabaseConfig) Validate() error {
	if d.Host == "" {
		return fmt.Errorf("host 不能为空")
	}
	if d.Port < 1 || d.Port > 65535 {
		return fmt.Errorf("port 必须在 1-65535 之间")
	}
	if d.User == "" {
		return fmt.Errorf("user 不能为空")
	}
	if !postgresDatabaseNamePattern.MatchString(d.Name) {
		return fmt.Errorf("name 只能包含字母、数字、下划线或中划线，且必须以字母或下划线开头，最长 63 位")
	}
	if !postgresDatabaseNamePattern.MatchString(d.MaintenanceDB) {
		return fmt.Errorf("maintenance_db 格式不合法")
	}
	switch d.SSLMode {
	case "disable", "allow", "prefer", "require", "verify-ca", "verify-full":
	default:
		return fmt.Errorf("ssl_mode 不支持 %q", d.SSLMode)
	}
	if d.TimeZone == "" {
		return fmt.Errorf("timezone 不能为空")
	}
	if _, err := time.LoadLocation(d.TimeZone); err != nil {
		return fmt.Errorf("timezone 不合法: %w", err)
	}
	return nil
}

func (d DatabaseConfig) DSN(databaseName string) string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s TimeZone=%s",
		quotePostgresDSNValue(d.Host),
		d.Port,
		quotePostgresDSNValue(d.User),
		quotePostgresDSNValue(d.Password),
		quotePostgresDSNValue(databaseName),
		quotePostgresDSNValue(d.SSLMode),
		d.TimeZone,
	)
}

func quotePostgresDSNValue(value string) string {
	escaped := strings.NewReplacer(`\`, `\\`, `'`, `\'`).Replace(value)
	return `'` + escaped + `'`
}
