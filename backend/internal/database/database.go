package database

import (
	"fmt"
	"log"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"authcenter/backend/internal/config"
	"authcenter/backend/internal/models"
	"authcenter/backend/internal/util"
)

func Init(cfg *config.Config) (*gorm.DB, error) {
	// 先无库连接建库
	raw, err := gorm.Open(mysql.Open(cfg.Database.DSN(false)), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, fmt.Errorf("连接 MySQL 失败: %w", err)
	}
	createSQL := fmt.Sprintf(
		"CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
		cfg.Database.Name,
	)
	if err := raw.Exec(createSQL).Error; err != nil {
		return nil, fmt.Errorf("创建数据库失败: %w", err)
	}
	if sqlDB, err := raw.DB(); err == nil {
		_ = sqlDB.Close()
	}

	db, err := gorm.Open(mysql.Open(cfg.Database.DSN(true)), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, fmt.Errorf("连接数据库失败: %w", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetMaxOpenConns(50)
	sqlDB.SetConnMaxLifetime(time.Hour)

	if err := db.AutoMigrate(models.AllModels()...); err != nil {
		return nil, fmt.Errorf("迁移表结构失败: %w", err)
	}
	if err := ensureOrderAccessTokens(db); err != nil {
		return nil, fmt.Errorf("补齐订单访问令牌失败: %w", err)
	}
	if err := seed(db, cfg); err != nil {
		return nil, fmt.Errorf("初始化种子数据失败: %w", err)
	}
	return db, nil
}

func ensureOrderAccessTokens(db *gorm.DB) error {
	var orders []models.PurchaseOrder
	if err := db.Where("access_token = '' OR access_token IS NULL").Find(&orders).Error; err != nil {
		return err
	}
	for _, order := range orders {
		token, err := util.GenerateToken()
		if err != nil {
			return err
		}
		if err := db.Model(&models.PurchaseOrder{}).Where("id = ?", order.ID).Update("access_token", token).Error; err != nil {
			return err
		}
	}
	return nil
}

// seed 幂等：管理员账号 + 默认设置
func seed(db *gorm.DB, cfg *config.Config) error {
	var adminCount int64
	if err := db.Model(&models.Admin{}).Count(&adminCount).Error; err != nil {
		return err
	}
	if adminCount == 0 {
		hash, err := bcrypt.GenerateFromPassword([]byte(cfg.Admin.Password), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		if err := db.Create(&models.Admin{Username: cfg.Admin.Username, Password: string(hash), MustChangePassword: true}).Error; err != nil {
			return err
		}
		log.Printf("已创建管理员账号 %s（初始密码来自 config.yaml，首次登录必须修改）", cfg.Admin.Username)
	} else if cfg.Admin.Password != "" {
		var admin models.Admin
		if err := db.Where("username = ?", cfg.Admin.Username).First(&admin).Error; err == nil && !admin.MustChangePassword {
			if bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte(cfg.Admin.Password)) == nil {
				if err := db.Model(&admin).Update("must_change_password", true).Error; err != nil {
					return err
				}
				log.Printf("管理员账号 %s 仍在使用初始密码，已要求首次登录后修改", cfg.Admin.Username)
			}
		}
	}

	defaults := map[string]string{
		models.SettingHeartbeatIntervalHours: "6",
		models.SettingGracePeriodDays:        "7",
	}
	for k, v := range defaults {
		var count int64
		if err := db.Model(&models.Setting{}).Where("setting_key = ?", k).Count(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			if err := db.Create(&models.Setting{Key: k, Value: v}).Error; err != nil {
				return err
			}
		}
	}
	return nil
}
