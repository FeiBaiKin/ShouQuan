<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storefrontApi } from '@/api'
import { extractError } from '@/api'
import { parseFeatures, type Product, type PricingPlan } from '@/types'

const route = useRoute()
const router = useRouter()
const product = ref<Product | null>(null)
const plans = ref<PricingPlan[]>([])
const latestVersion = ref('')
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const { data } = await storefrontApi.product(route.params.slug as string)
    product.value = data.product
    plans.value = data.plans
    latestVersion.value = data.latest_version
  } catch (e) {
    error.value = extractError(e)
  } finally {
    loading.value = false
  }
})

function goBuy(planId: number) {
  router.push({ name: 'buy', params: { planId } })
}

function durationLabel(t: string, days: number): string {
  if (t === 'permanent') return '永久授权'
  if (t === 'yearly') return '一年授权'
  return `${days} 天授权`
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-5 py-12 md:py-16">
    <div v-if="loading" class="text-center py-20 text-zinc-500">加载中...</div>
    <div v-else-if="error" class="text-center py-20 text-red-500">{{ error }}</div>
    <template v-else-if="product">
      <!-- 产品头部 -->
      <div class="mb-12">
        <h1 class="text-3xl md:text-4xl font-semibold tracking-tight">{{ product.name }}</h1>
        <p class="mt-3 text-zinc-600 dark:text-zinc-400 max-w-[60ch]">{{ product.remark || '软件授权与自动升级服务' }}</p>
        <div class="mt-4 flex items-center gap-4 text-sm text-zinc-500">
          <span>最新版本 v{{ latestVersion || '-' }}</span>
          <span class="h-1 w-1 rounded-full bg-zinc-400"></span>
          <span>产品标识 <code class="font-mono text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900">{{ product.slug }}</code></span>
        </div>
      </div>

      <!-- 特性说明 -->
      <section class="mb-14 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <h3 class="font-semibold mb-3">接入方式</h3>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            程序内嵌产品公钥，启动时调用激活接口绑定域名，之后定时心跳上报运行状态。所有响应均经 Ed25519 签名，客户端本地验签。
          </p>
        </div>
        <div class="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <h3 class="font-semibold mb-3">自动升级</h3>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            心跳响应携带最新版本号与 SHA256。有新版本时申请一次性下载令牌，下载更新包校验完整性后自动替换并重启。
          </p>
        </div>
      </section>

      <!-- 套餐 -->
      <section>
        <h2 class="text-xl md:text-2xl font-semibold tracking-tight mb-6">选择授权套餐</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div
            v-for="(plan, idx) in plans"
            :key="plan.id"
            class="relative p-6 rounded-xl border transition-colors flex flex-col"
            :class="idx === 0
              ? 'border-emerald-500 dark:border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
              : 'border-zinc-200 dark:border-zinc-800'"
          >
            <span
              v-if="idx === 0"
              class="absolute -top-2.5 left-6 px-2 py-0.5 text-[11px] font-medium rounded bg-emerald-600 text-white"
            >推荐</span>
            <div class="text-sm font-medium text-zinc-700 dark:text-zinc-300">{{ plan.name }}</div>
            <div class="mt-3 flex items-baseline gap-1">
              <span class="text-3xl font-semibold tracking-tight">¥{{ plan.price }}</span>
              <span class="text-sm text-zinc-500">/ {{ durationLabel(plan.duration_type, plan.duration_days) }}</span>
            </div>
            <ul class="mt-5 space-y-2 text-sm text-zinc-600 dark:text-zinc-400 flex-1">
              <li v-for="(f, i) in parseFeatures(plan.features)" :key="i" class="flex items-start gap-2">
                <span class="mt-1.5 h-1 w-1 rounded-full bg-emerald-500 shrink-0"></span>
                <span>{{ f }}</span>
              </li>
            </ul>
            <button
              @click="goBuy(plan.id)"
              class="mt-6 w-full py-2.5 rounded-md text-sm font-medium transition-colors"
              :class="idx === 0
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900'"
            >
              立即购买
            </button>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
