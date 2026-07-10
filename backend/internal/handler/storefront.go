package handler

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/mail"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"authcenter/backend/internal/app"
	"authcenter/backend/internal/models"
	"authcenter/backend/internal/service"
	"authcenter/backend/internal/service/payment"
)

// ====== 前台公开 API ======

// StorefrontProduct 前台产品列表项（产品 + 启用套餐）
type StorefrontProduct struct {
	models.Product
	Plans         []models.PricingPlan `json:"plans"`
	LatestVersion string               `json:"latest_version"`
}

// StorefrontListProducts GET /api/storefront/products
// 仅返回有启用套餐的产品（前台只展示可购买的）
func StorefrontListProducts(c *gin.Context) {
	a := getApp(c)
	var products []models.Product
	if err := a.DB.Order("id ASC").Find(&products).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}
	result := make([]StorefrontProduct, 0, len(products))
	for _, p := range products {
		var plans []models.PricingPlan
		a.DB.Where("product_id = ? AND enabled = ?", p.ID, true).Order("sort_order ASC, id ASC").Find(&plans)
		if len(plans) == 0 {
			continue // 无套餐的产品不在前台展示
		}
		row := StorefrontProduct{Product: p, Plans: plans}
		if latest := latestPublishedRelease(a, p.ID); latest != nil {
			row.LatestVersion = latest.Version
		}
		result = append(result, row)
	}
	c.JSON(http.StatusOK, result)
}

// StorefrontGetProduct GET /api/storefront/products/:slug
func StorefrontGetProduct(c *gin.Context) {
	a := getApp(c)
	var product models.Product
	if err := a.DB.Where("slug = ?", strings.ToLower(strings.TrimSpace(c.Param("slug")))).First(&product).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "产品不存在"})
		return
	}
	var plans []models.PricingPlan
	a.DB.Where("product_id = ? AND enabled = ?", product.ID, true).Order("sort_order ASC, id ASC").Find(&plans)
	if latest := latestPublishedRelease(a, product.ID); latest != nil {
		_ = latest
	}
	c.JSON(http.StatusOK, gin.H{
		"product": product,
		"plans":   plans,
		"latest_version": func() string {
			if r := latestPublishedRelease(a, product.ID); r != nil {
				return r.Version
			}
			return ""
		}(),
	})
}

// StorefrontPaymentMethods GET /api/storefront/payment-methods
func StorefrontPaymentMethods(c *gin.Context) {
	a := getApp(c)
	cfg := a.PaymentConfig()
	c.JSON(http.StatusOK, gin.H{"methods": payment.EnabledMethods(cfg)})
}

// StorefrontCreateOrderRequest 创建订单请求体
type StorefrontCreateOrderRequest struct {
	PlanID        uint   `json:"plan_id" binding:"required"`
	Email         string `json:"email" binding:"required"`
	CustomerName  string `json:"customer_name"`
	PaymentMethod string `json:"payment_method" binding:"required"` // alipay / wechat
	Scene         string `json:"scene"`                             // 可选：page / precreate；不传走默认
}

// StorefrontCreateOrder POST /api/storefront/orders
// 创建订单并调支付 Provider 下单，返回支付参数（二维码或跳转 URL）
func StorefrontCreateOrder(c *gin.Context) {
	a := getApp(c)
	var req StorefrontCreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数不完整"})
		return
	}
	// 邮箱校验
	if _, err := mail.ParseAddress(req.Email); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "邮箱格式不正确"})
		return
	}
	// 支付方式校验
	cfg := a.PaymentConfig()
	enabled := false
	for _, m := range cfg.EnabledProviders {
		if m == req.PaymentMethod {
			enabled = true
			break
		}
	}
	if !enabled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "该支付方式未启用"})
		return
	}
	provider, err := payment.Get(req.PaymentMethod)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 加载套餐与产品
	var plan models.PricingPlan
	if err := a.DB.Preload("Product").First(&plan, req.PlanID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "套餐不存在"})
		return
	}
	if !plan.Enabled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "套餐已下架"})
		return
	}
	if plan.Product == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "产品不存在"})
		return
	}
	if plan.Price <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "套餐价格异常"})
		return
	}

	// 生成订单号 + 写入订单
	orderNo := generateOrderNo()
	accessToken, err := utilGenerateOrderToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成订单访问令牌失败"})
		return
	}
	subject := fmt.Sprintf("%s %s 授权", plan.Product.Name, plan.Name)
	order := models.PurchaseOrder{
		OrderNo:       orderNo,
		AccessToken:   accessToken,
		ProductID:     plan.ProductID,
		PlanID:        plan.ID,
		Email:         req.Email,
		CustomerName:  strings.TrimSpace(req.CustomerName),
		Amount:        plan.Price,
		Status:        models.OrderPending,
		PaymentMethod: req.PaymentMethod,
	}
	expiresAt := time.Now().Add(30 * time.Minute) // 订单 30 分钟过期
	order.ExpiresAt = &expiresAt
	if err := a.DB.Create(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建订单失败"})
		return
	}

	// 调支付下单
	scene := req.Scene
	if scene == "" {
		scene = defaultScene(req.PaymentMethod, cfg)
	}
	payOrder := payment.Order{
		OrderNo: orderNo,
		Amount:  plan.Price,
		Subject: subject,
	}
	extra := map[string]string{"User-Agent": c.GetHeader("User-Agent")}
	result, err := provider.CreatePayment(payOrder, cfg, scene, extra)
	if err != nil {
		// 下单失败：关闭订单
		a.DB.Model(&order).Update("status", models.OrderClosed)
		slog.Error("[前台] 支付下单失败", "orderNo", orderNo, "err", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "支付下单失败：" + err.Error()})
		return
	}

	// 回填 payment_scene
	a.DB.Model(&order).Update("payment_scene", result.Scene)

	c.JSON(http.StatusOK, gin.H{
		"order_no":     orderNo,
		"access_token": accessToken,
		"amount":       plan.Price,
		"type":         result.Type,
		"scene":        result.Scene,
		"pay_url":      result.PayUrl,
		"qr_code":      result.QRCode,
		"expires_at":   expiresAt.Unix(),
	})
}

// defaultScene 根据支付方式返回默认场景
func defaultScene(method string, cfg payment.PaymentConfig) string {
	if method == "wechat" {
		return "native"
	}
	if method == "alipay" {
		return cfg.AliScene // page / precreate
	}
	return ""
}

// StorefrontOrderStatus GET /api/storefront/orders/:orderNo
// 轮询用：返回订单状态；paid 时附带授权码
func StorefrontOrderStatus(c *gin.Context) {
	a := getApp(c)
	order, ok := loadStorefrontOrder(c, a)
	if !ok {
		return
	}
	refreshOrderExpiry(a, order)
	resp := gin.H{
		"order_no":       order.OrderNo,
		"amount":         order.Amount,
		"status":         order.Status,
		"payment_method": order.PaymentMethod,
		"paid_at":        order.PaidAt,
		"expires_at":     order.ExpiresAt,
	}
	if order.Status == models.OrderPaid && order.LicenseID != nil {
		var license models.License
		if err := a.DB.First(&license, *order.LicenseID).Error; err == nil {
			resp["license_code"] = license.Code
		}
		// 附带最新已发布版本信息，供前台展示「下载部署包」按钮（下载链接不外露）
		if latest := latestPublishedRelease(a, order.ProductID); latest != nil {
			resp["latest_version"] = latest.Version
			resp["file_size"] = latest.FileSize
		}
	}
	c.JSON(http.StatusOK, resp)
}

// StorefrontDownloadRelease GET /api/storefront/orders/:orderNo/download
// 凭订单访问令牌下载该产品最新已发布部署包（仅 paid 订单）。
// 直接回传文件流，不向前端暴露真实存储路径 / release id。
func StorefrontDownloadRelease(c *gin.Context) {
	a := getApp(c)
	order, ok := loadStorefrontOrder(c, a)
	if !ok {
		return
	}
	if order.Status != models.OrderPaid {
		c.JSON(http.StatusForbidden, gin.H{"error": "订单未支付，无法下载"})
		return
	}
	release := latestPublishedRelease(a, order.ProductID)
	if release == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "暂无可用部署包"})
		return
	}
	path := filepath.Join(a.Cfg.ReleaseDir, release.FileName)
	if _, err := os.Stat(path); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "部署包文件缺失"})
		return
	}
	a.DB.Model(release).UpdateColumn("downloads", gorm.Expr("downloads + 1"))
	c.FileAttachment(path, release.OriginalName)
}

// StorefrontResendEmail POST /api/storefront/orders/:orderNo/resend-email
// 重新发送授权码邮件（仅 paid 订单）
func StorefrontResendEmail(c *gin.Context) {
	a := getApp(c)
	order, ok := loadStorefrontOrder(c, a, "Plan.Product", "License")
	if !ok {
		return
	}
	if order.Status != models.OrderPaid || order.LicenseID == nil || order.License == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "订单未支付或未生成授权码"})
		return
	}
	productName := "授权"
	if order.Plan != nil && order.Plan.Product != nil {
		productName = order.Plan.Product.Name
	}
	expiresHint := service.FormatExpiresHint(order.License.DurationType, order.License.DurationDays)
	emailCfg := a.EmailConfig()
	if !emailCfg.Configured() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "邮件服务未配置"})
		return
	}
	if err := service.SendLicenseEmail(emailCfg, order.Email, productName, order.License.Code, expiresHint); err != nil {
		slog.Error("[前台] 重发授权码邮件失败", "orderNo", order.OrderNo, "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "邮件发送失败：" + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "邮件已发送"})
}

// ====== 支付回调 ======

// PaymentCallbackWechat POST /api/payment/callback/wechat
func PaymentCallbackWechat(c *gin.Context) {
	a := getApp(c)
	body, _ := io.ReadAll(c.Request.Body)
	cfg := a.PaymentConfig()
	provider, err := payment.Get("wechat")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"code": "FAIL"})
		return
	}
	result, err := provider.VerifyCallback(payment.CallbackRequest{
		Method: c.Request.Method,
		Body:   body,
		Headers: map[string]string{
			"Wechatpay-Signature": c.GetHeader("Wechatpay-Signature"),
			"Wechatpay-Timestamp": c.GetHeader("Wechatpay-Timestamp"),
			"Wechatpay-Nonce":     c.GetHeader("Wechatpay-Nonce"),
			"Wechatpay-Serial":    c.GetHeader("Wechatpay-Serial"),
		},
	}, cfg)
	if err != nil {
		slog.Error("[微信回调] 验签异常", "err", err)
		c.JSON(http.StatusOK, gin.H{"code": "FAIL"})
		return
	}
	if result.Skip {
		c.JSON(http.StatusOK, gin.H{"code": "SUCCESS"})
		return
	}
	if !result.Verified {
		c.JSON(http.StatusOK, gin.H{"code": "FAIL"})
		return
	}
	if err := fulfillOrder(c, a, result, "wechat"); err != nil {
		slog.Error("[微信回调] 入账失败", "orderNo", result.OrderNo, "err", err)
		c.JSON(http.StatusOK, gin.H{"code": "FAIL"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": "SUCCESS"})
}

// PaymentCallbackAlipay POST /api/payment/callback/alipay（异步通知）
func PaymentCallbackAlipay(c *gin.Context) {
	a := getApp(c)
	// 支付宝回调为 form body。sign 参数中的 + 必须用 PathUnescape 保留（QueryUnescape 会转空格导致验签失败）
	params := parseAlipayCallbackParams(c)
	cfg := a.PaymentConfig()
	provider, err := payment.Get("alipay")
	if err != nil {
		c.String(http.StatusOK, "fail")
		return
	}
	result, err := provider.VerifyCallback(payment.CallbackRequest{
		Method: c.Request.Method,
		Query:  params,
	}, cfg)
	if err != nil {
		slog.Error("[支付宝回调] 验签异常", "err", err)
		c.String(http.StatusOK, "fail")
		return
	}
	if result.Skip {
		c.String(http.StatusOK, "success")
		return
	}
	if !result.Verified {
		c.String(http.StatusOK, "fail")
		return
	}
	if err := fulfillOrder(c, a, result, "alipay"); err != nil {
		slog.Error("[支付宝回调] 入账失败", "orderNo", result.OrderNo, "err", err)
		c.String(http.StatusOK, "fail")
		return
	}
	c.String(http.StatusOK, "success")
}

// PaymentCallbackAlipayReturn GET /api/payment/callback/alipay（同步返回）
// 重定向到前台支付结果页
func PaymentCallbackAlipayReturn(c *gin.Context) {
	orderNo := c.Query("out_trade_no")
	siteURL := getApp(c).Cfg.Site.BaseURL
	if siteURL == "" {
		siteURL = "/"
	}
	siteURL = strings.TrimRight(siteURL, "/")
	target := siteURL + "/pay-result?order=" + url.QueryEscape(orderNo)
	c.Redirect(http.StatusFound, target)
}

// parseAlipayCallbackParams 解析支付宝回调参数。
// sign 字段必须用 url.PathUnescape 保留 +（base64 中的 +），其余字段用 QueryUnescape。
func parseAlipayCallbackParams(c *gin.Context) map[string]string {
	params := map[string]string{}
	_ = c.Request.ParseForm()
	for k, vs := range c.Request.Form {
		if len(vs) == 0 {
			continue
		}
		if k == "sign" {
			// sign 用 PathUnescape 保留 +（base64 加号）
			if v, err := url.PathUnescape(vs[0]); err == nil {
				params[k] = v
			} else {
				params[k] = vs[0]
			}
		} else {
			if v, err := url.QueryUnescape(vs[0]); err == nil {
				params[k] = v
			} else {
				params[k] = vs[0]
			}
		}
	}
	return params
}

// fulfillOrder 入账：调 ProcessPaidOrder 生成授权码，并异步发邮件
func fulfillOrder(c *gin.Context, a *app.App, result payment.CallbackResult, method string) error {
	order, _, err := payment.ProcessPaidOrder(a.DB, result.OrderNo, fmt.Sprintf("%.2f", result.Amount), result.TradeNo)
	if err != nil {
		return err
	}
	if order == nil || order.LicenseID == nil {
		return nil
	}
	// 异步发送授权码邮件（不阻塞回调响应）
	go func(orderNo, email string, licenseID, planID uint) {
		var lic models.License
		if err := a.DB.First(&lic, licenseID).Error; err != nil {
			slog.Error("[回调] 加载授权码失败", "licenseId", licenseID, "err", err)
			return
		}
		var plan models.PricingPlan
		a.DB.Preload("Product").First(&plan, planID)
		productName := "授权"
		if plan.Product != nil {
			productName = plan.Product.Name
		}
		emailCfg := a.EmailConfig()
		if !emailCfg.Configured() {
			slog.Warn("[回调] 邮件未配置，跳过发送授权码邮件", "orderNo", orderNo)
			return
		}
		expiresHint := service.FormatExpiresHint(lic.DurationType, lic.DurationDays)
		if err := service.SendLicenseEmail(emailCfg, email, productName, lic.Code, expiresHint); err != nil {
			slog.Error("[回调] 发送授权码邮件失败", "orderNo", orderNo, "err", err)
		}
	}(order.OrderNo, order.Email, *order.LicenseID, order.PlanID)
	return nil
}

// generateOrderNo 生成订单号：L + 毫秒时间戳 + 6 位 hex 随机
func generateOrderNo() string {
	b := make([]byte, 3)
	rand.Read(b)
	return fmt.Sprintf("L%d%s", time.Now().UnixMilli(), hex.EncodeToString(b))
}

func utilGenerateOrderToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func orderAccessToken(c *gin.Context) string {
	if token := strings.TrimSpace(c.GetHeader("X-Order-Token")); token != "" {
		return token
	}
	return strings.TrimSpace(c.Query("token"))
}

func loadStorefrontOrder(c *gin.Context, a *app.App, preloads ...string) (*models.PurchaseOrder, bool) {
	var order models.PurchaseOrder
	query := a.DB
	for _, preload := range preloads {
		query = query.Preload(preload)
	}
	if err := query.Where("order_no = ?", c.Param("orderNo")).First(&order).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "订单不存在"})
		return nil, false
	}
	token := orderAccessToken(c)
	if order.AccessToken == "" || token == "" || subtle.ConstantTimeCompare([]byte(token), []byte(order.AccessToken)) != 1 {
		c.JSON(http.StatusForbidden, gin.H{"error": "订单访问令牌无效"})
		return nil, false
	}
	return &order, true
}

func refreshOrderExpiry(a *app.App, order *models.PurchaseOrder) {
	if order.Status != models.OrderPending || order.ExpiresAt == nil || !time.Now().After(*order.ExpiresAt) {
		return
	}
	res := a.DB.Model(&models.PurchaseOrder{}).
		Where("id = ? AND status = ?", order.ID, models.OrderPending).
		Update("status", models.OrderExpired)
	if res.Error == nil && res.RowsAffected > 0 {
		order.Status = models.OrderExpired
	}
}
