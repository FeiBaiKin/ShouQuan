import axios from 'axios'
import type {
  StorefrontProduct,
  Product,
  PricingPlan,
  PaymentMethod,
  CreateOrderResult,
  OrderStatusResult,
  License,
  LicenseEvent,
  HeartbeatLog,
  Release,
  DashboardData,
  SettingsData,
  PurchaseOrder,
  OrderStats,
  PaymentConfigData,
} from './types'

// 生产环境同源部署（Go 托管），baseURL 用相对路径；
// 开发环境通过 NEXT_PUBLIC_API_BASE 指向后端（如 http://localhost:5000），后端已开 CORS。
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? ''

// 后台管理 API：请求携带 JWT；401/403 拦截跳转。
export const api = axios.create({ baseURL: `${API_BASE}/api`, timeout: 30000 })

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (typeof window !== 'undefined') {
      const status = err.response?.status
      if (status === 401 && !location.pathname.startsWith('/admin/login')) {
        localStorage.removeItem('token')
        localStorage.removeItem('username')
        localStorage.removeItem('must_change_password')
        location.href = '/admin/login'
      } else if (status === 403 && err.response?.data?.must_change_password) {
        localStorage.setItem('must_change_password', 'true')
        if (!location.pathname.startsWith('/admin/change-password')) {
          location.href = '/admin/change-password'
        }
      }
    }
    return Promise.reject(err)
  },
)

// 前台公开 API：不带 JWT，前台订单鉴权走 X-Order-Token
const store = axios.create({ baseURL: `${API_BASE}/api/storefront`, timeout: 30000 })

export function extractError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { error?: string } | undefined)?.error ?? err.message
  }
  return String(err)
}

// blob 响应出错时错误体本身是 Blob(JSON)，需读出后再取 error 字段
export async function extractBlobError(err: unknown): Promise<string> {
  if (axios.isAxiosError(err) && err.response?.data instanceof Blob) {
    try {
      const text = await err.response.data.text()
      const obj = JSON.parse(text)
      if (obj?.error) return obj.error
    } catch {
      // 落回通用处理
    }
  }
  return extractError(err)
}

export const storefrontApi = {
  products: () => store.get<StorefrontProduct[]>('/products'),
  product: (slug: string) =>
    store.get<{ product: Product; plans: PricingPlan[]; latest_version: string }>(
      `/products/${slug}`,
    ),
  paymentMethods: () => store.get<{ methods: PaymentMethod[] }>('/payment-methods'),
  createOrder: (data: {
    plan_id: number
    email: string
    customer_name?: string
    payment_method: string
    scene?: string
  }) => store.post<CreateOrderResult>('/orders', data),
  orderStatus: (orderNo: string, accessToken: string) =>
    store.get<OrderStatusResult>(`/orders/${orderNo}`, {
      headers: { 'X-Order-Token': accessToken },
    }),
  downloadRelease: (orderNo: string, accessToken: string) =>
    store.get<Blob>(`/orders/${orderNo}/download`, {
      headers: { 'X-Order-Token': accessToken },
      responseType: 'blob',
    }),
  resendEmail: (orderNo: string, accessToken: string) =>
    store.post(`/orders/${orderNo}/resend-email`, null, {
      headers: { 'X-Order-Token': accessToken },
    }),
}

// ====== 后台管理 API ======

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ token: string; username: string; must_change_password: boolean }>('/admin/login', {
      username,
      password,
    }),
  profile: () => api.get<{ username: string; must_change_password: boolean }>('/admin/profile'),
  changePassword: (oldPassword: string, newPassword: string) =>
    api.put('/admin/password', { old_password: oldPassword, new_password: newPassword }),
}

export const dashboardApi = {
  get: () => api.get<DashboardData>('/admin/dashboard'),
}

export const productApi = {
  list: () => api.get<Product[]>('/admin/products'),
  create: (data: { name: string; slug: string; remark: string }) =>
    api.post<Product>('/admin/products', data),
  update: (id: number, data: { name: string; remark: string }) =>
    api.put<Product>(`/admin/products/${id}`, data),
  remove: (id: number) => api.delete(`/admin/products/${id}`),
}

export interface LicenseQuery {
  product_id?: number | null
  status?: string | null
  q?: string
  page: number
  page_size: number
}

export const licenseApi = {
  list: (params: LicenseQuery) =>
    api.get<{ total: number; items: License[]; page: number; page_size: number }>(
      '/admin/licenses',
      { params },
    ),
  create: (data: {
    product_id: number
    customer_name: string
    customer_contact: string
    remark: string
    duration_type: string
    duration_days: number
    count: number
  }) => api.post<{ items: License[] }>('/admin/licenses', data),
  detail: (id: number) =>
    api.get<{ license: License; events: LicenseEvent[]; heartbeats: HeartbeatLog[] }>(
      `/admin/licenses/${id}`,
    ),
  update: (id: number, data: { customer_name: string; customer_contact: string; remark: string }) =>
    api.put<License>(`/admin/licenses/${id}`, data),
  renew: (id: number, data: { days?: number; permanent?: boolean }) =>
    api.post<License>(`/admin/licenses/${id}/renew`, data),
  rebind: (id: number, domain: string) =>
    api.post<License>(`/admin/licenses/${id}/rebind`, { domain }),
  revoke: (id: number) => api.post<License>(`/admin/licenses/${id}/revoke`),
  restore: (id: number) => api.post<License>(`/admin/licenses/${id}/restore`),
  reset: (id: number) => api.post<License>(`/admin/licenses/${id}/reset`),
  remove: (id: number) => api.delete(`/admin/licenses/${id}`),
}

export const releaseApi = {
  list: (productId?: number | null) =>
    api.get<Release[]>('/admin/releases', {
      params: productId ? { product_id: productId } : {},
    }),
  upload: (form: FormData, onProgress?: (percent: number) => void) =>
    api.post<Release>('/admin/releases', form, {
      timeout: 0,
      onUploadProgress: (e) => {
        if (e.total && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
      },
    }),
  update: (id: number, data: { changelog: string; forced: boolean }) =>
    api.put<Release>(`/admin/releases/${id}`, data),
  publish: (id: number) => api.post<Release>(`/admin/releases/${id}/publish`),
  unpublish: (id: number) => api.post<Release>(`/admin/releases/${id}/unpublish`),
  remove: (id: number) => api.delete(`/admin/releases/${id}`),
}

export const settingsApi = {
  get: () => api.get<SettingsData>('/admin/settings'),
  update: (data: SettingsData) => api.put('/admin/settings', data),
}

export const planApi = {
  list: (productId?: number | null) =>
    api.get<PricingPlan[]>('/admin/plans', { params: productId ? { product_id: productId } : {} }),
  create: (
    data: Omit<
      PricingPlan,
      'id' | 'created_at' | 'updated_at' | 'product' | 'product_name' | 'product_slug'
    >,
  ) => api.post<PricingPlan>('/admin/plans', data),
  update: (id: number, data: Partial<PricingPlan>) =>
    api.put<PricingPlan>(`/admin/plans/${id}`, data),
  remove: (id: number) => api.delete(`/admin/plans/${id}`),
}

export interface OrderQuery {
  status?: string | null
  product_id?: number | null
  method?: string | null
  q?: string
  page: number
  page_size: number
}

export const orderApi = {
  list: (params: OrderQuery) =>
    api.get<{ total: number; items: PurchaseOrder[]; page: number; page_size: number }>(
      '/admin/orders',
      { params },
    ),
  detail: (id: number) => api.get<PurchaseOrder>(`/admin/orders/${id}`),
  stats: () => api.get<OrderStats>('/admin/orders/stats'),
}

export const paymentConfigApi = {
  get: () => api.get<PaymentConfigData>('/admin/payment-config'),
  update: (data: PaymentConfigData) => api.put('/admin/payment-config', data),
  testEmail: (to: string) => api.post('/admin/payment-config/test-email', { to }),
}
