package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"authcenter/backend/internal/models"
)

// planRow 套餐列表项（附带产品名）
type planRow struct {
	models.PricingPlan
	ProductName string `json:"product_name"`
	ProductSlug string `json:"product_slug"`
}

func toPlanRow(p models.PricingPlan) planRow {
	r := planRow{PricingPlan: p}
	if p.Product != nil {
		r.ProductName = p.Product.Name
		r.ProductSlug = p.Product.Slug
	}
	return r
}

// ListPlans GET /api/admin/plans?product_id=
func ListPlans(c *gin.Context) {
	a := getApp(c)
	query := a.DB.Model(&models.PricingPlan{})
	if pid := c.Query("product_id"); pid != "" {
		query = query.Where("product_id = ?", pid)
	}
	var plans []models.PricingPlan
	if err := query.Preload("Product").Order("product_id ASC, sort_order ASC, id ASC").Find(&plans).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}
	rows := make([]planRow, 0, len(plans))
	for _, p := range plans {
		rows = append(rows, toPlanRow(p))
	}
	c.JSON(http.StatusOK, rows)
}

// CreatePlan POST /api/admin/plans
func CreatePlan(c *gin.Context) {
	a := getApp(c)
	var req struct {
		ProductID    uint    `json:"product_id" binding:"required"`
		Name         string  `json:"name" binding:"required"`
		Price        float64 `json:"price" binding:"required"`
		DurationType string  `json:"duration_type" binding:"required"`
		DurationDays int     `json:"duration_days"`
		Features     string  `json:"features"`
		Remark       string  `json:"remark"`
		SortOrder    int     `json:"sort_order"`
		Enabled      bool    `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数不完整"})
		return
	}
	if req.Price <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "套餐价格需大于 0"})
		return
	}
	switch req.DurationType {
	case models.DurationYearly:
		req.DurationDays = 365
	case models.DurationPermanent:
		req.DurationDays = 0
	case models.DurationCustom:
		if req.DurationDays < 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "自定义期限天数需大于 0"})
			return
		}
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "期限类型不合法"})
		return
	}
	// 校验产品存在
	var product models.Product
	if err := a.DB.First(&product, req.ProductID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "产品不存在"})
		return
	}
	plan := models.PricingPlan{
		ProductID:    req.ProductID,
		Name:         req.Name,
		Price:        req.Price,
		DurationType: req.DurationType,
		DurationDays: req.DurationDays,
		Features:     req.Features,
		Remark:       req.Remark,
		SortOrder:    req.SortOrder,
		Enabled:      req.Enabled,
	}
	if err := a.DB.Create(&plan).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建失败"})
		return
	}
	plan.Product = &product
	c.JSON(http.StatusOK, toPlanRow(plan))
}

// UpdatePlan PUT /api/admin/plans/:id
func UpdatePlan(c *gin.Context) {
	a := getApp(c)
	id, _ := strconv.Atoi(c.Param("id"))
	var plan models.PricingPlan
	if err := a.DB.First(&plan, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "套餐不存在"})
		return
	}
	var req struct {
		Name         string  `json:"name" binding:"required"`
		Price        float64 `json:"price" binding:"required"`
		DurationType string  `json:"duration_type" binding:"required"`
		DurationDays int     `json:"duration_days"`
		Features     string  `json:"features"`
		Remark       string  `json:"remark"`
		SortOrder    int     `json:"sort_order"`
		Enabled      bool    `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数不完整"})
		return
	}
	if req.Price <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "套餐价格需大于 0"})
		return
	}
	switch req.DurationType {
	case models.DurationYearly:
		req.DurationDays = 365
	case models.DurationPermanent:
		req.DurationDays = 0
	case models.DurationCustom:
		if req.DurationDays < 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "自定义期限天数需大于 0"})
			return
		}
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "期限类型不合法"})
		return
	}
	plan.Name = req.Name
	plan.Price = req.Price
	plan.DurationType = req.DurationType
	plan.DurationDays = req.DurationDays
	plan.Features = req.Features
	plan.Remark = req.Remark
	plan.SortOrder = req.SortOrder
	plan.Enabled = req.Enabled
	if err := a.DB.Save(&plan).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存失败"})
		return
	}
	a.DB.Preload("Product").First(&plan, plan.ID)
	c.JSON(http.StatusOK, toPlanRow(plan))
}

// DeletePlan DELETE /api/admin/plans/:id
func DeletePlan(c *gin.Context) {
	a := getApp(c)
	id, _ := strconv.Atoi(c.Param("id"))
	var plan models.PricingPlan
	if err := a.DB.First(&plan, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "套餐不存在"})
		return
	}
	// 检查是否有 paid 订单关联
	var orderCount int64
	a.DB.Model(&models.PurchaseOrder{}).Where("plan_id = ? AND status = ?", plan.ID, models.OrderPaid).Count(&orderCount)
	if orderCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "该套餐已有成功订单，无法删除（建议禁用）"})
		return
	}
	if err := a.DB.Delete(&plan).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "已删除"})
}
