package config

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

type ServerConfig struct {
	Port           int      `mapstructure:"port"`
	AllowedOrigins []string `mapstructure:"allowed_origins"`
}

type DatabaseConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
	Name     string `mapstructure:"name"`
}

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
	Name    string `mapstructure:"name"`    // 站点名称，用于邮件标题等
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
	v.SetDefault("database.port", 3306)
	v.SetDefault("database.name", "authcenter")
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

func (d *DatabaseConfig) DSN(withDB bool) string {
	base := fmt.Sprintf("%s:%s@tcp(%s:%d)/", d.User, d.Password, d.Host, d.Port)
	if withDB {
		base += d.Name
	}
	return base + "?charset=utf8mb4&parseTime=True&loc=Local"
}
