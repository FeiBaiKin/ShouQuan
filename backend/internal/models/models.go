package models

import "time"

// Admin 管理员（单账号体系，首次启动按配置种子创建）
type Admin struct {
	ID                 uint      `gorm:"primaryKey" json:"id"`
	Username           string    `gorm:"size:64;uniqueIndex;not null" json:"username"`
	Password           string    `gorm:"size:128;not null" json:"-"` // bcrypt
	MustChangePassword bool      `gorm:"not null;default:false" json:"must_change_password"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

func (Admin) TableName() string { return "admins" }

// Product 接入的产品（如 XZJI），持有一对 Ed25519 密钥用于授权响应签名
type Product struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	Name       string    `gorm:"size:128;not null" json:"name"`
	Slug       string    `gorm:"size:64;uniqueIndex;not null" json:"slug"` // 产品标识，接入方调用 API 时携带
	PublicKey  string    `gorm:"size:128;not null" json:"public_key"`      // base64，嵌入接入方程序
	PrivateKey string    `gorm:"size:256;not null" json:"-"`               // base64，仅服务端持有
	Remark     string    `gorm:"size:512" json:"remark"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

func (Product) TableName() string { return "products" }

// License 状态（持久化状态；expired 为运行时按 ExpiresAt 计算的生效状态）
const (
	LicenseUnactivated = "unactivated"
	LicenseActive      = "active"
	LicenseRevoked     = "revoked"
	LicenseExpired     = "expired" // 仅作为生效状态/筛选值，不落库
)

// 授权期限类型
const (
	DurationYearly    = "yearly"
	DurationPermanent = "permanent"
	DurationCustom    = "custom"
)

// License 授权
type License struct {
	ID              uint       `gorm:"primaryKey" json:"id"`
	ProductID       uint       `gorm:"index;not null" json:"product_id"`
	Product         *Product   `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	Code            string     `gorm:"size:64;uniqueIndex;not null" json:"code"`
	CustomerName    string     `gorm:"size:128" json:"customer_name"`
	CustomerContact string     `gorm:"size:128" json:"customer_contact"`
	Remark          string     `gorm:"size:512" json:"remark"`
	DurationType    string     `gorm:"size:16;not null" json:"duration_type"` // yearly / permanent / custom
	DurationDays    int        `json:"duration_days"`                         // custom 时的天数；yearly 固定 365
	Status          string     `gorm:"size:16;not null;default:unactivated;index" json:"status"`
	Domain          string     `gorm:"size:255;index" json:"domain"`
	ActivatedAt     *time.Time `json:"activated_at"`
	ExpiresAt       *time.Time `json:"expires_at"` // 已激活且为 nil 表示永久
	LastHeartbeatAt *time.Time `json:"last_heartbeat_at"`
	LastVersion     string     `gorm:"size:32" json:"last_version"`
	LastIP          string     `gorm:"size:64" json:"last_ip"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

func (License) TableName() string { return "licenses" }

// EffectiveStatus 生效状态：吊销 > 未激活 > 过期 > 有效
func (l *License) EffectiveStatus() string {
	switch l.Status {
	case LicenseRevoked:
		return LicenseRevoked
	case LicenseUnactivated:
		return LicenseUnactivated
	}
	if l.ExpiresAt != nil && time.Now().After(*l.ExpiresAt) {
		return LicenseExpired
	}
	return LicenseActive
}

// Release 版本更新包
type Release struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	ProductID    uint      `gorm:"index:idx_product_version,unique;not null" json:"product_id"`
	Product      *Product  `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	Version      string    `gorm:"size:32;index:idx_product_version,unique;not null" json:"version"`
	Changelog    string    `gorm:"type:text" json:"changelog"`
	FileName     string    `gorm:"size:255;not null" json:"file_name"` // release 目录内相对路径
	OriginalName string    `gorm:"size:255" json:"original_name"`
	FileSize     int64     `json:"file_size"`
	SHA256       string    `gorm:"size:64" json:"sha256"`
	Forced       bool      `json:"forced"`
	Published    bool      `gorm:"index" json:"published"`
	Downloads    int       `json:"downloads"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func (Release) TableName() string { return "releases" }

// HeartbeatLog 心跳记录（定期清理，默认保留 90 天）
type HeartbeatLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	LicenseID uint      `gorm:"index" json:"license_id"`
	Domain    string    `gorm:"size:255" json:"domain"`
	Version   string    `gorm:"size:32" json:"version"`
	IP        string    `gorm:"size:64" json:"ip"`
	Result    string    `gorm:"size:32" json:"result"` // active / expired / revoked / domain_mismatch
	CreatedAt time.Time `gorm:"index" json:"created_at"`
}

func (HeartbeatLog) TableName() string { return "heartbeat_logs" }

// LicenseEvent 授权关键事件（创建/激活/续期/改绑/吊销/恢复/重置）
type LicenseEvent struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	LicenseID uint      `gorm:"index" json:"license_id"`
	Type      string    `gorm:"size:32" json:"type"`
	Detail    string    `gorm:"size:512" json:"detail"`
	CreatedAt time.Time `json:"created_at"`
}

func (LicenseEvent) TableName() string { return "license_events" }

// DownloadToken 一次性下载令牌
type DownloadToken struct {
	ID        uint       `gorm:"primaryKey" json:"id"`
	Token     string     `gorm:"size:64;uniqueIndex;not null" json:"token"`
	ReleaseID uint       `gorm:"index;not null" json:"release_id"`
	LicenseID uint       `gorm:"index;not null" json:"license_id"`
	ExpiresAt time.Time  `json:"expires_at"`
	UsedAt    *time.Time `json:"used_at"`
	CreatedAt time.Time  `json:"created_at"`
}

func (DownloadToken) TableName() string { return "download_tokens" }

// Setting KV 系统设置
type Setting struct {
	Key   string `gorm:"primaryKey;size:64;column:setting_key" json:"key"`
	Value string `gorm:"type:text" json:"value"`
}

func (Setting) TableName() string { return "settings" }

// 设置键
const (
	SettingHeartbeatIntervalHours = "heartbeat_interval_hours" // 默认 6
	SettingGracePeriodDays        = "grace_period_days"        // 默认 7
)

// ====== 前台购买相关 ======

// 订单状态
const (
	OrderPending = "pending"
	OrderPaid    = "paid"
	OrderExpired = "expired"
	OrderClosed  = "closed"
)

// PricingPlan 套餐：一个产品可挂多个套餐（年付/永久/自定义），前台购买时选择
type PricingPlan struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	ProductID    uint      `gorm:"index;not null" json:"product_id"`
	Product      *Product  `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	Name         string    `gorm:"size:64;not null" json:"name"` // 如「年付」「永久」「季付」
	Price        float64   `gorm:"type:decimal(10,2);not null" json:"price"`
	DurationType string    `gorm:"size:16;not null" json:"duration_type"` // yearly / permanent / custom
	DurationDays int       `json:"duration_days"`                         // custom 时的天数；yearly 固定 365
	Features     string    `gorm:"type:text" json:"features"`             // JSON 数组字符串，如 ["商业授权","一年更新"]
	Remark       string    `gorm:"size:512" json:"remark"`
	SortOrder    int       `gorm:"default:0" json:"sort_order"`
	Enabled      bool      `gorm:"index;default:true" json:"enabled"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func (PricingPlan) TableName() string { return "pricing_plans" }

// PurchaseOrder 购买订单：用户在前台下单购买授权
type PurchaseOrder struct {
	ID            uint         `gorm:"primaryKey" json:"id"`
	OrderNo       string       `gorm:"size:32;uniqueIndex;not null" json:"order_no"`
	AccessToken   string       `gorm:"size:64;index" json:"-"`
	ProductID     uint         `gorm:"index;not null" json:"product_id"`
	Product       *Product     `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	PlanID        uint         `gorm:"index;not null" json:"plan_id"`
	Plan          *PricingPlan `gorm:"foreignKey:PlanID" json:"plan,omitempty"`
	Email         string       `gorm:"size:128;index;not null" json:"email"`
	CustomerName  string       `gorm:"size:128" json:"customer_name"`
	Amount        float64      `gorm:"type:decimal(10,2);not null" json:"amount"`
	Status        string       `gorm:"size:16;not null;default:pending;index" json:"status"`
	PaymentMethod string       `gorm:"size:16" json:"payment_method"` // alipay / wechat
	PaymentScene  string       `gorm:"size:16" json:"payment_scene"`  // page / wap / precreate / native
	TradeNo       string       `gorm:"size:64" json:"trade_no"`
	LicenseID     *uint        `gorm:"index" json:"license_id"` // 支付成功后回填
	License       *License     `gorm:"foreignKey:LicenseID" json:"license,omitempty"`
	PaidAt        *time.Time   `json:"paid_at"`
	ExpiresAt     *time.Time   `json:"expires_at"` // 订单过期时间（pending 超时变 expired）
	CreatedAt     time.Time    `json:"created_at"`
	UpdatedAt     time.Time    `json:"updated_at"`
}

func (PurchaseOrder) TableName() string { return "purchase_orders" }

func AllModels() []any {
	return []any{
		&Admin{}, &Product{}, &License{}, &Release{},
		&HeartbeatLog{}, &LicenseEvent{}, &DownloadToken{}, &Setting{},
		&PricingPlan{}, &PurchaseOrder{},
	}
}
