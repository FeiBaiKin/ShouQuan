import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // ---- 前台（公开） ----
    {
      path: '/',
      component: () => import('@/layouts/StorefrontLayout.vue'),
      children: [
        { path: '', name: 'home', component: () => import('@/views/storefront/HomeView.vue') },
        { path: 'product/:slug', name: 'product', component: () => import('@/views/storefront/ProductView.vue') },
        { path: 'buy/:planId', name: 'buy', component: () => import('@/views/storefront/BuyView.vue') },
        { path: 'pay/:orderNo', name: 'pay', component: () => import('@/views/storefront/PayView.vue') },
        { path: 'pay-result', name: 'pay-result', component: () => import('@/views/storefront/PayResultView.vue') },
        { path: 'success/:orderNo', name: 'success', component: () => import('@/views/storefront/SuccessView.vue') },
      ],
    },

    // ---- 后台登录 ----
    {
      path: '/admin/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },

    // ---- 后台（需登录） ----
    {
      path: '/admin',
      component: () => import('@/layouts/AdminLayout.vue'),
      children: [
        { path: '', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
        { path: 'products', name: 'products', component: () => import('@/views/ProductsView.vue') },
        { path: 'plans', name: 'plans', component: () => import('@/views/PlansView.vue') },
        { path: 'licenses', name: 'licenses', component: () => import('@/views/LicensesView.vue') },
        { path: 'orders', name: 'orders', component: () => import('@/views/OrdersView.vue') },
        { path: 'releases', name: 'releases', component: () => import('@/views/ReleasesView.vue') },
        { path: 'payment', name: 'payment-config', component: () => import('@/views/PaymentConfigView.vue') },
        { path: 'settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
      ],
    },

    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  // 后台路由（除登录页）需鉴权
  const isAdminRoute = to.path.startsWith('/admin') && to.name !== 'login'
  if (isAdminRoute && !auth.token) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'login' && auth.token) {
    return { name: 'dashboard' }
  }
})

export default router
