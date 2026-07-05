<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storefrontApi, extractError } from '@/api'
import { parseFeatures, type PricingPlan, type PaymentMethod } from '@/types'

const route = useRoute()
const router = useRouter()

const plan = ref<PricingPlan | null>(null)
const methods = ref<PaymentMethod[]>([])
const loading = ref(true)
const error = ref('')

const email = ref('')
const customerName = ref('')
const paymentMethod = ref('')
const submitting = ref(false)

onMounted(async () => {
  // 套餐信息从产品列表中取（避免单独接口）
  try {
    const [prodResp, methodResp] = await Promise.all([
      storefrontApi.products(),
      storefrontApi.paymentMethods(),
    ])
    methods.value = methodResp.data.methods
    if (methods.value.length) paymentMethod.value = methods.value[0].name
    const planId = Number(route.params.planId)
    for (const p of prodResp.data) {
      const found = p.plans.find((pl) => pl.id === planId)
      if (found) {
        plan.value = { ...found, product: p }
        break
      }
    }
    if (!plan.value) error.value = '套餐不存在或已下架'
  } catch (e) {
    error.value = extractError(e)
  } finally {
    loading.value = false
  }
})

async function submit() {
  if (!plan.value) return
  if (!email.value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    error.value = '请填写有效的邮箱地址'
    return
  }
  if (!paymentMethod.value) {
    error.value = '请选择支付方式'
    return
  }
  error.value = ''
  submitting.value = true
  try {
    const { data } = await storefrontApi.createOrder({
      plan_id: plan.value.id,
      email: email.value,
      customer_name: customerName.value,
      payment_method: paymentMethod.value,
    })
    sessionStorage.setItem(
      'pay_' + data.order_no,
      JSON.stringify({
        access_token: data.access_token,
        qr_code: data.qr_code,
        pay_url: data.pay_url,
        scene: data.scene,
        type: data.type,
        expires_at: data.expires_at,
      }),
    )
    // 支付宝 page / wap 场景：跳转到支付宝收银台
    if (data.type === 'alipay' && (data.scene === 'page' || data.scene === 'wap')) {
      window.location.href = data.pay_url
      return
    }
    // 其余场景（微信 native / 支付宝 precreate）：跳到支付页展示二维码
    // 先把支付参数缓存到 sessionStorage，供 PayView 渲染二维码
    router.push({ name: 'pay', params: { orderNo: data.order_no } })
  } catch (e) {
    error.value = extractError(e)
  } finally {
    submitting.value = false
  }
}

function durationLabel(t: string, days: number): string {
  if (t === 'permanent') return '永久授权'
  if (t === 'yearly') return '一年授权'
  return `${days} 天授权`
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-5 py-12 md:py-16">
    <div v-if="loading" class="text-center py-20 text-zinc-500">加载中...</div>
    <div v-else-if="error && !plan" class="text-center py-20">
      <p class="text-red-500 mb-4">{{ error }}</p>
      <RouterLink to="/" class="text-emerald-600 dark:text-emerald-400 hover:underline text-sm">返回首页</RouterLink>
    </div>
    <template v-else-if="plan">
      <h1 class="text-2xl md:text-3xl font-semibold tracking-tight mb-2">确认订单</h1>
      <p class="text-sm text-zinc-500 mb-8">请核对套餐信息并填写接收邮箱</p>

      <!-- 套餐概要 -->
      <div class="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 mb-8">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="text-sm text-zinc-500">{{ plan.product?.name || '产品' }}</div>
            <div class="mt-1 font-semibold text-lg">{{ plan.name }}</div>
            <div class="mt-1 text-sm text-zinc-500">{{ durationLabel(plan.duration_type, plan.duration_days) }}</div>
          </div>
          <div class="text-2xl font-semibold tracking-tight">¥{{ plan.price }}</div>
        </div>
        <ul v-if="parseFeatures(plan.features).length" class="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          <li v-for="(f, i) in parseFeatures(plan.features)" :key="i" class="flex items-start gap-2">
            <span class="mt-1.5 h-1 w-1 rounded-full bg-emerald-500 shrink-0"></span>
            <span>{{ f }}</span>
          </li>
        </ul>
      </div>

      <!-- 表单 -->
      <form @submit.prevent="submit" class="space-y-5">
        <div>
          <label for="email" class="block text-sm font-medium mb-1.5">接收邮箱 <span class="text-red-500">*</span></label>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="you@example.com"
            class="w-full px-3.5 py-2.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
          />
          <p class="mt-1.5 text-xs text-zinc-500">授权码将发送至此邮箱，请确保地址正确。</p>
        </div>
        <div>
          <label for="name" class="block text-sm font-medium mb-1.5">称呼（可选）</label>
          <input
            id="name"
            v-model="customerName"
            type="text"
            placeholder="您的姓名或站点名"
            class="w-full px-3.5 py-2.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">支付方式</label>
          <div class="grid grid-cols-2 gap-3">
            <button
              v-for="m in methods"
              :key="m.name"
              type="button"
              @click="paymentMethod = m.name"
              class="px-4 py-3 rounded-md border text-sm font-medium transition-colors text-left"
              :class="paymentMethod === m.name
                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400'
                : 'border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900'"
            >
              {{ m.label }}
            </button>
          </div>
          <p v-if="!methods.length" class="mt-2 text-xs text-red-500">暂无可用支付方式，请联系管理员。</p>
        </div>

        <div v-if="error" class="text-sm text-red-500">{{ error }}</div>

        <button
          type="submit"
          :disabled="submitting || !methods.length"
          class="w-full py-3 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
        >
          {{ submitting ? '创建订单中...' : `支付 ¥${plan.price}` }}
        </button>
      </form>
    </template>
  </div>
</template>
