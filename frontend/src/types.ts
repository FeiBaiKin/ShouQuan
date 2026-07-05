export interface Product {
  id: number
  name: string
  slug: string
  public_key: string
  remark: string
  created_at: string
  updated_at: string
  license_count?: number
  release_count?: number
  latest_version?: string
}

export type LicenseStatus = 'unactivated' | 'active' | 'expired' | 'revoked'
export type DurationType = 'yearly' | 'permanent' | 'custom'

export interface License {
  id: number
  product_id: number
  code: string
  customer_name: string
  customer_contact: string
  remark: string
  duration_type: DurationType
  duration_days: number
  status: string
  effective_status: LicenseStatus
  domain: string
  activated_at: string | null
  expires_at: string | null
  last_heartbeat_at: string | null
  last_version: string
  last_ip: string
  created_at: string
  product_name?: string
  product_slug?: string
}

export interface Release {
  id: number
  product_id: number
  product?: Product
  version: string
  changelog: string
  file_name: string
  original_name: string
  file_size: number
  sha256: string
  forced: boolean
  published: boolean
  downloads: number
  created_at: string
}

export interface LicenseEvent {
  id: number
  license_id: number
  type: string
  detail: string
  created_at: string
  code?: string
  product_name?: string
}

export interface HeartbeatLog {
  id: number
  license_id: number
  domain: string
  version: string
  ip: string
  result: string
  created_at: string
}

export interface DashboardData {
  license_total: number
  license_active: number
  license_expiring: number
  license_unactivated: number
  license_revoked: number
  sites_active_24h: number
  products: {
    id: number
    name: string
    slug: string
    license_count: number
    active_count: number
    latest_version: string
  }[]
  recent_events: LicenseEvent[]
  expiring_list: License[]
}

export interface SettingsData {
  heartbeat_interval_hours: number
  grace_period_days: number
}

// ====== 前台与订单 ======

export interface PricingPlan {
  id: number
  product_id: number
  product?: Product
  name: string
  price: number
  duration_type: DurationType
  duration_days: number
  features: string // JSON 数组字符串
  remark: string
  sort_order: number
  enabled: boolean
  created_at: string
  updated_at: string
  product_name?: string
  product_slug?: string
}

export interface StorefrontProduct extends Product {
  plans: PricingPlan[]
}

export type OrderStatus = 'pending' | 'paid' | 'expired' | 'closed'

export interface PurchaseOrder {
  id: number
  order_no: string
  product_id: number
  plan_id: number
  email: string
  customer_name: string
  amount: number
  status: OrderStatus
  payment_method: string
  payment_scene: string
  trade_no: string
  license_id: number | null
  paid_at: string | null
  expires_at: string | null
  created_at: string
  product_name?: string
  plan_name?: string
  license_code?: string
}

export interface CreateOrderResult {
  order_no: string
  amount: number
  type: string // wechat / alipay
  scene: string // native / page / wap / precreate
  pay_url: string
  qr_code: string
}

export interface PaymentMethod {
  name: string
  label: string
  scenes: string[]
}

export interface OrderStats {
  total_revenue: number
  today_revenue: number
  total_orders: number
  paid_orders: number
  pending_orders: number
}

export interface PaymentConfigData {
  payment: Record<string, string>
  email: Record<string, string>
  site: Record<string, string>
}

export function parseFeatures(features: string): string[] {
  if (!features) return []
  try {
    const arr = JSON.parse(features)
    return Array.isArray(arr) ? arr.map(String) : []
  } catch {
    return []
  }
}
