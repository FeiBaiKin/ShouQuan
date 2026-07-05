<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QRCode from 'qrcode'
import { storefrontApi, extractError } from '@/api'

const route = useRoute()
const router = useRouter()

const orderNo = route.params.orderNo as string
const qrDataUrl = ref('')
const payUrl = ref('')
const orderType = ref('') // wechat / alipay
const orderScene = ref('')
const amount = ref(0)
const status = ref('pending') // pending / paid / expired / closed
const licenseCode = ref('')
const copied = ref(false)
const error = ref('')
const loading = ref(true)

let pollTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  // 先查订单拿到支付参数快照，再轮询状态
  try {
    const { data } = await storefrontApi.orderStatus(orderNo)
    amount.value = data.amount
    orderType.value = data.payment_method
    status.value = data.status
    if (data.status === 'paid' && data.license_code) {
      licenseCode.value = data.license_code
      loading.value = false
      return
    }
  } catch (e) {
    error.value = extractError(e)
    loading.value = false
    return
  }

  // 获取二维码：重新下单不可行（会创建新订单），故本页依赖跳转前已生成的二维码参数。
  // 支付宝 page 场景不会进入此页（已在 BuyView 跳转），进入此页的都是二维码场景。
  // 二维码内容需从 sessionStorage 取（BuyView 创建订单后存入）。
  const cached = sessionStorage.getItem('pay_' + orderNo)
  if (cached) {
    try {
      const obj = JSON.parse(cached)
      payUrl.value = obj.qr_code || obj.pay_url || ''
      orderScene.value = obj.scene || ''
      if (payUrl.value) {
        qrDataUrl.value = await QRCode.toDataURL(payUrl.value, { width: 220, margin: 1 })
      }
    } catch {
      // ignore
    }
  }
  loading.value = false
  startPolling()
})

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    try {
      const { data } = await storefrontApi.orderStatus(orderNo)
      status.value = data.status
      if (data.status === 'paid') {
        if (data.license_code) licenseCode.value = data.license_code
        stopPolling()
      } else if (data.status === 'expired' || data.status === 'closed') {
        stopPolling()
      }
    } catch {
      // 轮询失败静默忽略，下次重试
    }
  }, 2000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onBeforeUnmount(() => stopPolling())

async function copyCode() {
  if (!licenseCode.value) return
  try {
    await navigator.clipboard.writeText(licenseCode.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // 兜底
    const ta = document.createElement('textarea')
    ta.value = licenseCode.value
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  }
}

function goSuccess() {
  router.push({ name: 'success', params: { orderNo } })
}

function methodLabel(): string {
  if (orderType.value === 'wechat') return '微信支付'
  if (orderType.value === 'alipay') return '支付宝'
  return '扫码支付'
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-5 py-12 md:py-16">
    <div v-if="loading" class="text-center py-20 text-zinc-500">加载中...</div>
    <div v-else-if="error" class="text-center py-20">
      <p class="text-red-500 mb-4">{{ error }}</p>
      <RouterLink to="/" class="text-emerald-600 dark:text-emerald-400 hover:underline text-sm">返回首页</RouterLink>
    </div>
    <template v-else>
      <!-- 支付成功态 -->
      <div v-if="status === 'paid'" class="text-center">
        <div class="mx-auto h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center mb-5">
          <svg class="h-8 w-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 class="text-2xl font-semibold tracking-tight mb-2">支付成功</h1>
        <p class="text-sm text-zinc-500 mb-6">授权码已生成并发送至您的邮箱</p>

        <div class="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 mb-5">
          <div class="text-xs text-zinc-500 mb-2">您的授权码</div>
          <div class="font-mono text-xl md:text-2xl font-semibold tracking-wider break-all">{{ licenseCode || '加载中...' }}</div>
        </div>

        <div class="flex gap-3 justify-center">
          <button
            @click="copyCode"
            class="px-5 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
          >
            {{ copied ? '已复制' : '一键复制' }}
          </button>
          <button
            @click="goSuccess"
            class="px-5 py-2.5 rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-sm font-medium transition-colors"
          >
            查看详情
          </button>
        </div>
      </div>

      <!-- 待支付态：二维码 -->
      <div v-else-if="status === 'pending' && qrDataUrl" class="text-center">
        <h1 class="text-xl font-semibold tracking-tight mb-1">{{ methodLabel() }}扫码支付</h1>
        <p class="text-sm text-zinc-500 mb-6">请使用{{ methodLabel() }}扫描下方二维码完成支付</p>
        <div class="inline-block p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white">
          <img :src="qrDataUrl" alt="支付二维码" class="w-[220px] h-[220px]" />
        </div>
        <div class="mt-5 text-2xl font-semibold tracking-tight">¥{{ amount }}</div>
        <p class="mt-3 text-xs text-zinc-500">支付完成后此页面将自动更新，请勿关闭</p>
      </div>

      <!-- 待支付但无二维码（支付宝 page 跳转后回来） -->
      <div v-else-if="status === 'pending'" class="text-center py-10">
        <h1 class="text-xl font-semibold tracking-tight mb-2">等待支付确认</h1>
        <p class="text-sm text-zinc-500 mb-6">订单金额 ¥{{ amount }}，正在确认支付状态...</p>
        <div class="inline-block h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>

      <!-- 过期/关闭 -->
      <div v-else class="text-center py-10">
        <h1 class="text-xl font-semibold tracking-tight mb-2 text-red-500">订单已失效</h1>
        <p class="text-sm text-zinc-500 mb-6">订单状态：{{ status }}</p>
        <RouterLink to="/" class="text-emerald-600 dark:text-emerald-400 hover:underline text-sm">重新购买</RouterLink>
      </div>
    </template>
  </div>
</template>
