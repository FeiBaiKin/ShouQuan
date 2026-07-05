package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"authcenter/backend/internal/models"
)

// orderRow 订单列表项
type orderRow struct {
	models.PurchaseOrder
	ProductName string `json:"product_name"`
	PlanName    string `json:"plan_name"`
	LicenseCode string `json:"license_code"`
}

func toOrderRow(o models.PurchaseOrder) orderRow {
	r := orderRow{PurchaseOrder: o}
	if o.Product != nil {
		r.ProductName = o.Product.Name
	}
	if o.Plan != nil {
		r.PlanName = o.Plan.Name
	}
	if o.License != nil {
		r.LicenseCode = o.License.Code
	}
	return r
}

// ListOrders GET /api/admin/orders?status=&product_id=&method=&q=&page=&page_size=
func ListOrders(c *gin.Context) {
	a := getApp(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	query := a.DB.Model(&models.PurchaseOrder{})
	if pid := c.Query("product_id"); pid != "" {
		query = query.Where("product_id = ?", pid)
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if method := c.Query("method"); method != "" {
		query = query.Where("payment_method = ?", method)
	}
	if q := c.Query("q"); q != "" {
		like := "%" + q + "%"
		query = query.Where("order_no LIKE ? OR email LIKE ? OR customer_name LIKE ? OR trade_no LIKE ?", like, like, like, like)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}
	var orders []models.PurchaseOrder
	if err := query.Preload("Product").Preload("Plan").Preload("License").
		Order("id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}
	rows := make([]orderRow, 0, len(orders))
	for _, o := range orders {
		rows = append(rows, toOrderRow(o))
	}
	c.JSON(http.StatusOK, gin.H{"total": total, "items": rows, "page": page, "page_size": pageSize})
}

// GetOrder GET /api/admin/orders/:id
func GetOrder(c *gin.Context) {
	a := getApp(c)
	id, _ := strconv.Atoi(c.Param("id"))
	var order models.PurchaseOrder
	if err := a.DB.Preload("Product").Preload("Plan").Preload("License").
		First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "订单不存在"})
		return
	}
	c.JSON(http.StatusOK, toOrderRow(order))
}

// OrderStats GET /api/admin/orders/stats
// 订单统计：总收入、今日收入、订单数、待处理订单数
func OrderStats(c *gin.Context) {
	a := getApp(c)
	type stat struct {
		TotalRevenue   float64 `json:"total_revenue"`
		TodayRevenue   float64 `json:"today_revenue"`
		TotalOrders    int64   `json:"total_orders"`
		PaidOrders     int64   `json:"paid_orders"`
		PendingOrders  int64   `json:"pending_orders"`
	}
	var s stat
	a.DB.Model(&models.PurchaseOrder{}).Where("status = ?", models.OrderPaid).Count(&s.PaidOrders)
	a.DB.Model(&models.PurchaseOrder{}).Where("status = ?", models.OrderPaid).
		Select("COALESCE(SUM(amount),0)").Scan(&s.TotalRevenue)
	startOfDay := time.Now().Truncate(24 * time.Hour)
	a.DB.Model(&models.PurchaseOrder{}).
		Where("status = ? AND paid_at >= ?", models.OrderPaid, startOfDay).
		Select("COALESCE(SUM(amount),0)").Scan(&s.TodayRevenue)
	a.DB.Model(&models.PurchaseOrder{}).Count(&s.TotalOrders)
	a.DB.Model(&models.PurchaseOrder{}).Where("status = ?", models.OrderPending).Count(&s.PendingOrders)
	c.JSON(http.StatusOK, s)
}
