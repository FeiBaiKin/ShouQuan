<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storefrontApi } from '@/api'
import { extractError } from '@/api'
import { parseFeatures, type StorefrontProduct, type PaymentMethod } from '@/types'

const router = useRouter()
const products = ref<StorefrontProduct[]>([])
const methods = ref<PaymentMethod[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const [p, m] = await Promise.all([
      storefrontApi.products(),
      storefrontApi.paymentMethods(),
    ])
    products.value = p.data
    methods.value = m.data.methods
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
  <div>
    <!-- Hero: 非对称分屏 -->
    <section class="mx-auto max-w-6xl px-5 pt-20 pb-16 md:pt-24">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
        <div class="lg:col-span-7">
          <h1 class="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tighter leading-[1.05]">
            一行代码接入<br />
            <span class="text-emerald-600 dark:text-emerald-400">软件授权与升级</span>
          </h1>
          <p class="mt-6 text-lg text-zinc-600 dark:text-zinc-400 max-w-[52ch] leading-relaxed">
            为你的程序提供域名绑定授权、心跳校验、版本分发与一键升级。用户在线购买，授权码自动生成。
          </p>
          <div class="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#pricing"
              class="inline-flex items-center px-5 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors"
            >
              查看套餐
            </a>
            <RouterLink
              to="/product/xzji"
              class="inline-flex items-center px-5 py-2.5 rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-sm font-medium transition-colors"
              v-if="!products.length || products.some(p => p.slug === 'xzji')"
            >
              了解产品
            </RouterLink>
          </div>
        </div>

        <!-- 右侧：代码片段卡片 -->
        <div class="lg:col-span-5">
          <div class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 overflow-hidden">
            <div class="flex items-center gap-1.5 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <span class="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
              <span class="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
              <span class="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
              <span class="ml-2 text-xs text-zinc-500">activate.go</span>
            </div>
            <pre class="p-4 text-xs leading-relaxed overflow-x-auto text-zinc-700 dark:text-zinc-300"><code>// 激活授权（绑定域名）
resp, _ := license.Activate(&amp;ActivateReq{
    Code:   "XXXXX-XXXXX-XXXXX-XXXXX",
    Domain: "yoursite.com",
    Version: "1.0.0",
})
// Ed25519 验签，本地校验防伪造
if !license.VerifySignature(resp) {
    return errors.New("授权响应验签失败")
}</code></pre>
          </div>
        </div>
      </div>
    </section>

    <!-- 特性 Bento（非 3 等分卡片） -->
    <section class="mx-auto max-w-6xl px-5 py-16 border-t border-zinc-200/70 dark:border-zinc-800/70">
      <h2 class="text-2xl md:text-3xl font-semibold tracking-tight mb-10">核心能力</h2>
      <div class="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div class="md:col-span-3 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
          <div class="text-emerald-600 dark:text-emerald-400 text-sm font-medium mb-2">授权签名</div>
          <h3 class="text-lg font-semibold mb-2">Ed25519 防伪造</h3>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">每个产品独立密钥对，激活与心跳响应均签名，客户端公钥验签，服务端无法被中间人冒充。</p>
        </div>
        <div class="md:col-span-3 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
          <div class="text-emerald-600 dark:text-emerald-400 text-sm font-medium mb-2">心跳与宽限</div>
          <h3 class="text-lg font-semibold mb-2">离线容灾</h3>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">定时心跳上报状态，中心不可达时按宽限期继续运行，避免单点故障导致业务停摆。</p>
        </div>
        <div class="md:col-span-2 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div class="text-emerald-600 dark:text-emerald-400 text-sm font-medium mb-2">版本分发</div>
          <h3 class="text-lg font-semibold mb-2">一键升级</h3>
          <p class="text-sm text-zinc-600 dark:text-zinc-400">SHA256 校验、强制更新标记、一次性下载令牌。</p>
        </div>
        <div class="md:col-span-2 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div class="text-emerald-600 dark:text-emerald-400 text-sm font-medium mb-2">在线购买</div>
          <h3 class="text-lg font-semibold mb-2">自动发码</h3>
          <p class="text-sm text-zinc-600 dark:text-zinc-400">支付回调即时生成授权码并发至邮箱。</p>
        </div>
        <div class="md:col-span-2 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div class="text-emerald-600 dark:text-emerald-400 text-sm font-medium mb-2">支付方式</div>
          <h3 class="text-lg font-semibold mb-2">支付宝 + 微信</h3>
          <p class="text-sm text-zinc-600 dark:text-zinc-400">原生接入，无第三方中转，资金直达商户。</p>
        </div>
      </div>
    </section>

    <!-- 套餐定价 -->
    <section id="pricing" class="mx-auto max-w-6xl px-5 py-16 border-t border-zinc-200/70 dark:border-zinc-800/70">
      <div v-if="loading" class="text-center py-20 text-zinc-500">加载中...</div>
      <div v-else-if="error" class="text-center py-20 text-red-500">{{ error }}</div>
      <div v-else-if="!products.length" class="text-center py-20 text-zinc-500">
        暂无可购买的产品，请稍后再来。
      </div>
      <template v-else>
        <div v-for="prod in products" :key="prod.id" class="mb-14 last:mb-0">
          <div class="flex items-end justify-between mb-6">
            <div>
              <h2 class="text-2xl md:text-3xl font-semibold tracking-tight">{{ prod.name }}</h2>
              <p class="mt-1 text-sm text-zinc-500">最新版本 v{{ prod.latest_version || '-' }}</p>
            </div>
            <RouterLink
              :to="{ name: 'product', params: { slug: prod.slug } }"
              class="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              产品详情 →
            </RouterLink>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div
              v-for="(plan, idx) in prod.plans"
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
                <li v-if="!parseFeatures(plan.features).length" class="text-zinc-400">商业授权 + 全功能</li>
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
        </div>
      </template>
    </section>

    <!-- 工作流程 -->
    <section class="mx-auto max-w-6xl px-5 py-16 border-t border-zinc-200/70 dark:border-zinc-800/70">
      <h2 class="text-2xl md:text-3xl font-semibold tracking-tight mb-10">购买流程</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <div class="text-emerald-600 dark:text-emerald-400 text-sm font-mono mb-2">01</div>
          <h3 class="font-semibold mb-2">选择套餐</h3>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">挑选适合的授权期限，填写接收邮箱。</p>
        </div>
        <div>
          <div class="text-emerald-600 dark:text-emerald-400 text-sm font-mono mb-2">02</div>
          <h3 class="font-semibold mb-2">在线支付</h3>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">支付宝或微信扫码支付，资金直达商户账户。</p>
        </div>
        <div>
          <div class="text-emerald-600 dark:text-emerald-400 text-sm font-mono mb-2">03</div>
          <h3 class="font-semibold mb-2">获取授权码</h3>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">支付成功后授权码即时生成，页面展示并可一键复制，同时发送至邮箱。</p>
        </div>
      </div>
    </section>
  </div>
</template>
