<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { storefrontApi, extractError } from '@/api'

const route = useRoute()
const orderNo = route.params.orderNo as string

const loading = ref(true)
const licenseCode = ref('')
const amount = ref(0)
const status = ref('pending')
const copied = ref(false)
const resendMsg = ref('')
const resending = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    const { data } = await storefrontApi.orderStatus(orderNo)
    status.value = data.status
    amount.value = data.amount
    if (data.license_code) licenseCode.value = data.license_code
  } catch (e) {
    error.value = extractError(e)
  } finally {
    loading.value = false
  }
})

async function copyCode() {
  if (!licenseCode.value) return
  try {
    await navigator.clipboard.writeText(licenseCode.value)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = licenseCode.value
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

async function resendEmail() {
  resending.value = true
  resendMsg.value = ''
  try {
    const { data } = await storefrontApi.resendEmail(orderNo)
    resendMsg.value = data.message || '邮件已发送'
  } catch (e: any) {
    resendMsg.value = e.response?.data?.error || extractError(e)
  } finally {
    resending.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-5 py-12 md:py-16">
    <div v-if="loading" class="text-center py-20 text-zinc-500">加载中...</div>
    <div v-else-if="error" class="text-center py-20">
      <p class="text-red-500 mb-4">{{ error }}</p>
      <RouterLink to="/" class="text-emerald-600 dark:text-emerald-400 hover:underline text-sm">返回首页</RouterLink>
    </div>
    <template v-else-if="status === 'paid' && licenseCode">
      <div class="text-center mb-8">
        <div class="mx-auto h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center mb-5">
          <svg class="h-8 w-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 class="text-2xl font-semibold tracking-tight mb-2">购买成功</h1>
        <p class="text-sm text-zinc-500">授权码已发送至您的邮箱，请妥善保存</p>
      </div>

      <!-- 授权码卡片 -->
      <div class="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 mb-6">
        <div class="text-xs text-zinc-500 mb-3">您的授权码</div>
        <div class="font-mono text-xl md:text-2xl font-semibold tracking-wider break-all mb-4">{{ licenseCode }}</div>
        <button
          @click="copyCode"
          class="w-full py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
        >
          {{ copied ? '已复制到剪贴板' : '一键复制授权码' }}
        </button>
      </div>

      <!-- 激活指引 -->
      <div class="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 mb-6">
        <h3 class="font-semibold mb-3 text-sm">激活步骤</h3>
        <ol class="space-y-2 text-sm text-zinc-600 dark:text-zinc-400 list-decimal list-inside">
          <li>登录您的程序管理后台</li>
          <li>找到「授权设置」或「系统设置」入口</li>
          <li>填入上方授权码并点击激活</li>
          <li>激活后将自动绑定当前域名并开始计算有效期</li>
        </ol>
      </div>

      <!-- 重发邮件 -->
      <div class="text-center">
        <p v-if="resendMsg" class="text-sm mb-2" :class="resendMsg.includes('失败') || resendMsg.includes('未配置') ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'">
          {{ resendMsg }}
        </p>
        <button
          @click="resendEmail"
          :disabled="resending"
          class="text-sm text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
        >
          {{ resending ? '发送中...' : '重新发送授权码邮件' }}
        </button>
      </div>
    </template>
    <div v-else class="text-center py-20">
      <p class="text-zinc-500 mb-4">订单尚未支付或正在确认中</p>
      <RouterLink to="/" class="text-emerald-600 dark:text-emerald-400 hover:underline text-sm">返回首页</RouterLink>
    </div>
  </div>
</template>
