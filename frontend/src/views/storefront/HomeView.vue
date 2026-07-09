<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { storefrontApi, extractError } from '@/api'
import { parseFeatures, type StorefrontProduct } from '@/types'
import { NIcon } from 'naive-ui'
import {
  Check,
  ShieldCheck,
  Refresh,
  Cash,
  Rocket,
  Lifebuoy,
  ArrowRight,
  Plus,
  Minus,
  Search,
  Crown,
  ChartBar,
  LayoutGrid,
  Mail,
  InfoCircle,
  Bolt,
} from '@vicons/tabler'

const router = useRouter()
const products = ref<StorefrontProduct[]>([])
const loading = ref(true)
const error = ref('')

const primaryProduct = computed(() => products.value[0] || null)

// 最低价（价格锚点，放在定价区展示，不放 hero）
const startingPrice = computed(() => {
  const prices = products.value.flatMap((p) => p.plans.map((pl) => pl.price))
  return prices.length ? Math.min(...prices) : null
})

onMounted(async () => {
  try {
    const { data } = await storefrontApi.products()
    products.value = data
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
  if (t === 'permanent') return '一次买断，永久使用'
  if (t === 'yearly') return '有效期 365 天'
  return `有效期 ${days} 天`
}

// 机制型信任条：真实的授权系统事实，不编造用户数
const facts = [
  { term: '秒级', label: '自动发货', sub: '支付成功即时生成授权码' },
  { term: 'Ed25519', label: '签名验签', sub: '授权响应全程防伪造' },
  { term: 'SHA256', label: '升级校验', sub: '在线升级包完整性保障' },
  { term: '6 小时', label: '心跳容灾', sub: '断网进入离线宽限运行' },
]

// 购买须知：正版授权 / 持续更新 / 虚拟商品 / 技术支持
const notices = [
  { icon: ShieldCheck, title: '正版授权', desc: '授权码绑定域名激活，同域名重装可重复使用。' },
  { icon: Refresh, title: '持续更新', desc: '授权期内免费获取全部版本，后台一键在线升级。' },
  { icon: InfoCircle, title: '虚拟商品', desc: '授权激活后不支持退款，购买前请确认需求。' },
  { icon: Lifebuoy, title: '技术支持', desc: '授权中心提供部署协助与换绑域名等售后处理。' },
]

// 功能 Bento：用真实截图，4+2 / 2+4 交错排布
const bento = [
  {
    src: '/screenshots/keywords.png',
    icon: Search,
    tag: '关键词检索',
    title: '搜什么，出什么',
    desc: '每个关键词绑定资源介绍与下载链接，支持分类归组。前台输入即命中，运营只维护一张表。',
    span: 'lg:col-span-4',
    big: true,
  },
  {
    src: '/screenshots/membership.png',
    icon: Crown,
    tag: '会员变现',
    title: '付费下载与每日额度',
    desc: '体验 / 月度 / 年度多档自由配置，价格、时长、额度与折扣保存即时生效。',
    span: 'lg:col-span-2',
  },
  {
    src: '/screenshots/dashboard.png',
    icon: ChartBar,
    tag: '数据看板',
    title: '用户、收入、内容一览',
    desc: '注册、订单、活跃会员与内容数据今日 / 本周 / 本月增长一目了然。',
    span: 'lg:col-span-2',
  },
  {
    src: '/screenshots/categories.png',
    icon: LayoutGrid,
    tag: '资源浏览',
    title: '分类聚合与分页',
    desc: '自定义分类标签、收藏与一键复制，前台浏览体验开箱即用。',
    span: 'lg:col-span-4',
    big: true,
  },
]

// 为什么选择：极简两列，图标 + 文本，无卡片
const reasons = [
  { icon: Rocket, title: '开箱即用', desc: '关键词、会员、支付、后台全内置，无需二次开发即可上线运营。' },
  { icon: Search, title: '关键词驱动', desc: '以关键词映射资源，运营维护一张表，用户搜索即得，贴合下载站场景。' },
  { icon: Crown, title: '会员变现闭环', desc: '多档会员、每日额度、签到与折扣，从注册到付费下载形成完整闭环。' },
  { icon: Cash, title: '原生收款', desc: '支付宝、微信原生接入，资金直达商户，支付成功自动开通会员。' },
  { icon: ShieldCheck, title: '安全授权', desc: 'Ed25519 签名验签、域名绑定、心跳校验，防止授权被伪造与滥用。' },
  { icon: Refresh, title: '在线升级', desc: '后台一键检测并升级到最新版本，SHA256 校验保证升级包完整。' },
]

// 购买流程：横向连接步骤，用动词做标签
const steps = [
  { icon: LayoutGrid, title: '选择套餐', desc: '挑选授权期限，填写接收邮箱。' },
  { icon: Cash, title: '在线支付', desc: '支付宝或微信扫码，资金直达商户账户。' },
  { icon: Mail, title: '获取授权码', desc: '支付成功即时生成并发送邮箱，绑定域名即可上线。' },
]

// 常见问题（基于真实授权机制）
const faqs = [
  {
    q: '授权是如何绑定的？可以换域名吗？',
    a: '首次激活时授权码会绑定当前站点域名。同一域名下重装可重复激活；如需更换域名，请联系授权中心处理。',
  },
  {
    q: '需要联网校验吗？断网会不会停用？',
    a: '系统按固定间隔（默认 6 小时）向授权中心上报心跳。若授权中心暂时不可达，会进入离线宽限期继续运行，避免网络波动导致业务中断。',
  },
  {
    q: '如何升级到新版本？',
    a: '后台「系统设置 - 授权管理」内置版本检测与在线升级，发现新版本可一键更新，升级包经 SHA256 校验保证完整性。',
  },
  {
    q: '支持哪些支付方式？资金到谁的账户？',
    a: '原生接入支付宝与微信支付，为你自己的商户号，资金直达你的账户，无第三方中转。',
  },
  {
    q: '购买后如何交付？',
    a: '这是一套可自行部署的下载站系统。购买授权后你将获得授权码，绑定自己的域名激活即可上线，前后端已整合。',
  },
  {
    q: '虚拟商品支持退款吗？',
    a: '授权类虚拟商品一经激活不支持退款，请在购买前确认需求。如有疑问可先咨询授权中心。',
  },
]

const openFaq = ref<number | null>(0)
function toggleFaq(i: number) {
  openFaq.value = openFaq.value === i ? null : i
}

// 轻量滚动入场：IntersectionObserver（非 scroll 监听），尊重 reduced-motion
const revealSupported =
  typeof window !== 'undefined' && 'IntersectionObserver' in window
const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const vReveal = {
  mounted(el: HTMLElement) {
    if (!revealSupported || reduceMotion) {
      el.style.opacity = '1'
      el.style.transform = 'none'
      return
    }
    const delay = el.dataset.revealDelay || '0'
    el.style.opacity = '0'
    el.style.transform = 'translateY(18px)'
    el.style.transition = `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            ;(el as HTMLElement).style.opacity = '1'
            ;(el as HTMLElement).style.transform = 'none'
            io.unobserve(el)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    )
    io.observe(el)
    ;(el as any)._io = io
  },
  unmounted(el: HTMLElement) {
    ;(el as any)?._io?.disconnect()
  },
}
</script>

<template>
  <div>
    <!-- Hero：左文右图非对称，层叠截图 + 辉光 + 网格纹理 -->
    <section class="relative overflow-hidden">
      <!-- 背景装饰 -->
      <div class="pointer-events-none absolute inset-0" aria-hidden="true">
        <div class="hero-grid absolute inset-0"></div>
        <div
          class="absolute -top-32 right-[-12%] h-[420px] w-[640px] rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-500/10"
        ></div>
        <div
          class="absolute top-40 left-[-14%] h-[320px] w-[460px] rounded-full bg-emerald-300/10 blur-3xl dark:bg-emerald-400/5"
        ></div>
      </div>

      <div class="relative mx-auto max-w-6xl px-5 pt-16 pb-16 md:pt-24 md:pb-20">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
          <div class="lg:col-span-5" v-reveal>
            <span
              class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100/80 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-300/50 dark:border-emerald-500/30"
            >
              XZJI 下载站系统
            </span>
            <h1
              class="mt-5 text-4xl md:text-5xl font-bold tracking-tighter leading-[1.15] md:leading-[1.12]"
            >
              开箱即用的<br class="hidden md:block" />
              <span class="text-emerald-600 dark:text-emerald-400 whitespace-nowrap">资源下载站</span>系统
            </h1>
            <p
              class="mt-6 text-base md:text-lg text-zinc-600 dark:text-zinc-400 max-w-[42ch] leading-relaxed"
            >
              关键词检索、会员付费下载、支付宝 / 微信原生收款一站集成，绑定你的域名即刻上线。
            </p>
            <div class="mt-9 flex flex-wrap items-center gap-3">
              <a
                href="#pricing"
                class="inline-flex items-center gap-1.5 px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-medium text-sm transition shadow-lg shadow-emerald-600/25 dark:shadow-emerald-950/60"
              >
                查看授权方案
                <NIcon :component="ArrowRight" class="text-[15px]" />
              </a>
              <RouterLink
                v-if="primaryProduct"
                :to="{ name: 'product', params: { slug: primaryProduct.slug } }"
                class="inline-flex items-center px-6 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:border-emerald-400 dark:hover:border-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 active:scale-[0.98] text-sm font-medium transition"
              >
                产品详情
              </RouterLink>
            </div>
          </div>

          <!-- 层叠真实截图：后层看板 + 前层前台首页 -->
          <div class="relative lg:col-span-7" v-reveal data-reveal-delay="120">
            <div
              class="absolute -inset-6 rounded-[2rem] bg-emerald-400/10 blur-2xl dark:bg-emerald-500/10"
              aria-hidden="true"
            ></div>
            <!-- 后层：管理看板截图 -->
            <div
              class="absolute -top-8 -right-4 hidden md:block w-[58%] rotate-2 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 bg-zinc-50 dark:bg-zinc-900 overflow-hidden opacity-70 shadow-xl"
              aria-hidden="true"
            >
              <img
                src="/screenshots/dashboard.png"
                alt=""
                class="block w-full aspect-[16/10] object-cover object-top"
                loading="eager"
              />
            </div>
            <!-- 前层：前台首页截图（浏览器框） -->
            <div
              class="relative md:mt-10 md:mr-14 rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-900 overflow-hidden shadow-2xl shadow-zinc-900/10 dark:shadow-black/50"
            >
              <div
                class="flex items-center gap-1.5 px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/40"
              >
                <span class="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
                <span class="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
                <span class="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
                <span class="ml-3 flex-1 truncate text-xs text-zinc-400 dark:text-zinc-500 mono"
                  >yoursite.com</span
                >
              </div>
              <img
                src="/screenshots/home.png"
                alt="XZJI 前台首页：热门搜索、关键词检索、精选资源与会员中心"
                class="block w-full aspect-[16/11] object-cover object-top"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 机制信任条：硬事实大字排版，不编造用户数 -->
    <section class="mx-auto max-w-6xl px-5" v-reveal>
      <dl
        class="grid grid-cols-2 lg:grid-cols-4 border-y border-zinc-200/70 dark:border-zinc-800/70 divide-x divide-zinc-200/70 dark:divide-zinc-800/70"
      >
        <div v-for="f in facts" :key="f.label" class="px-5 py-6 first:pl-1 lg:px-7">
          <dt class="text-xs text-zinc-500 dark:text-zinc-500">{{ f.sub }}</dt>
          <dd class="mt-1.5 flex items-baseline gap-2 flex-wrap">
            <span class="text-xl md:text-2xl font-bold tracking-tight tnum text-zinc-900 dark:text-zinc-100">{{
              f.term
            }}</span>
            <span class="text-sm font-medium text-emerald-600 dark:text-emerald-400">{{
              f.label
            }}</span>
          </dd>
        </div>
      </dl>
    </section>

    <!-- 授权方案：价格前置，转化主区 -->
    <section id="pricing" class="mx-auto max-w-6xl px-5 py-20 md:py-24" v-reveal>
      <div class="mb-12 max-w-2xl">
        <h2 class="text-2xl md:text-4xl font-bold tracking-tight">选择适合你的授权方案</h2>
        <p class="mt-4 text-sm md:text-base text-zinc-500 dark:text-zinc-400">
          正版授权，绑定域名激活，内置在线升级
          <template v-if="startingPrice !== null">
            ，授权低至
            <span class="text-emerald-600 dark:text-emerald-400 font-semibold tnum"
              >¥{{ startingPrice }}</span
            >
            起
          </template>
        </p>
      </div>

      <!-- 加载骨架：与最终布局同形 -->
      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          v-for="i in 3"
          :key="i"
          class="h-96 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-900/60 animate-pulse"
        ></div>
      </div>
      <div v-else-if="error" class="text-center py-20 text-red-500">{{ error }}</div>
      <div v-else-if="!products.length" class="text-center py-20 text-zinc-500">
        暂无可购买的产品，请稍后再来。
      </div>
      <template v-else>
        <div v-for="prod in products" :key="prod.id" class="mb-16 last:mb-0">
          <div class="flex items-end justify-between mb-8">
            <div>
              <h3 class="text-xl md:text-2xl font-semibold tracking-tight">{{ prod.name }}</h3>
              <p class="mt-1 text-sm text-zinc-500">最新版本 v{{ prod.latest_version || '-' }}</p>
            </div>
            <RouterLink
              :to="{ name: 'product', params: { slug: prod.slug } }"
              class="text-sm text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
            >
              产品详情
              <NIcon :component="ArrowRight" class="text-[13px]" />
            </RouterLink>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            <div
              v-for="(plan, idx) in prod.plans"
              :key="plan.id"
              class="relative p-7 rounded-2xl border transition duration-300 hover:-translate-y-1 flex flex-col"
              :class="
                idx === 1
                  ? 'border-emerald-500/70 dark:border-emerald-500/60 bg-gradient-to-b from-emerald-50/80 to-white dark:from-emerald-500/[0.08] dark:to-zinc-900/40 shadow-[0_8px_40px_-12px_rgba(16,185,129,0.35)] md:-translate-y-2 md:hover:-translate-y-3'
                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-lg dark:hover:shadow-black/30'
              "
            >
              <span
                v-if="idx === 1"
                class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-medium rounded-full bg-emerald-600 text-white shadow shadow-emerald-600/40"
                >推荐</span
              >
              <div class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {{ plan.name }}
              </div>
              <div class="mt-4 flex items-baseline gap-1">
                <span class="text-lg font-semibold text-zinc-500 dark:text-zinc-400">¥</span>
                <span class="text-5xl font-bold tracking-tight tnum">{{ plan.price }}</span>
              </div>
              <div class="mt-2 text-sm text-zinc-500">
                {{ durationLabel(plan.duration_type, plan.duration_days) }}
              </div>
              <div class="my-5 h-px bg-zinc-200/80 dark:bg-zinc-800/80"></div>
              <ul class="space-y-3 text-sm text-zinc-600 dark:text-zinc-400 flex-1">
                <li
                  v-for="(f, i) in parseFeatures(plan.features)"
                  :key="i"
                  class="flex items-start gap-2.5"
                >
                  <NIcon
                    :component="Check"
                    size="16"
                    class="mt-0.5 shrink-0 text-emerald-500"
                  />
                  <span>{{ f }}</span>
                </li>
                <li v-if="!parseFeatures(plan.features).length" class="flex items-start gap-2.5">
                  <NIcon :component="Check" size="16" class="mt-0.5 shrink-0 text-emerald-500" />
                  <span>商业授权 + 全功能</span>
                </li>
              </ul>
              <button
                @click="goBuy(plan.id)"
                class="mt-7 w-full py-3 rounded-lg text-sm font-medium transition active:scale-[0.98]"
                :class="
                  idx === 1
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25'
                    : 'border border-zinc-300 dark:border-zinc-700 hover:border-emerald-400 dark:hover:border-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400'
                "
              >
                立即购买
              </button>
            </div>
          </div>
        </div>

        <!-- 购买须知：正版授权 / 持续更新 / 虚拟商品 / 技术支持 -->
        <div
          class="mt-12 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/30 px-7 py-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6"
        >
          <div v-for="n in notices" :key="n.title" class="flex items-start gap-3">
            <span
              class="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100/80 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            >
              <NIcon :component="n.icon" size="18" />
            </span>
            <div>
              <div class="text-sm font-semibold">{{ n.title }}</div>
              <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-500 leading-relaxed">
                {{ n.desc }}
              </p>
            </div>
          </div>
        </div>
      </template>
    </section>

    <!-- 功能 Bento：非对称真实截图网格 -->
    <section
      class="mx-auto max-w-6xl px-5 py-20 md:py-24 border-t border-zinc-200/70 dark:border-zinc-800/70"
      v-reveal
    >
      <div class="mb-12 max-w-2xl">
        <h2 class="text-2xl md:text-4xl font-bold tracking-tight">强大而完整的功能体系</h2>
        <p class="mt-4 text-sm md:text-base text-zinc-500 dark:text-zinc-400">
          从内容运营到会员变现，一套系统全覆盖。
        </p>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-6 gap-5">
        <article
          v-for="b in bento"
          :key="b.src"
          class="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 overflow-hidden flex flex-col transition duration-300 hover:-translate-y-1 hover:border-emerald-400/50 dark:hover:border-emerald-500/40 hover:shadow-xl dark:hover:shadow-black/40"
          :class="b.span"
        >
          <div
            class="relative h-52 md:h-64 shrink-0 overflow-hidden bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-200/70 dark:border-zinc-800/70"
          >
            <img
              :src="b.src"
              :alt="b.title"
              class="block w-full h-full object-cover object-top transition duration-700 group-hover:scale-[1.03]"
              loading="lazy"
            />
            <div
              class="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/60 to-transparent dark:from-zinc-900/60"
              aria-hidden="true"
            ></div>
          </div>
          <div class="p-6 flex-1" :class="b.big ? 'lg:p-7' : ''">
            <div class="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
              <NIcon :component="b.icon" size="16" />
              <span class="text-xs font-medium">{{ b.tag }}</span>
            </div>
            <h3 class="font-semibold tracking-tight" :class="b.big ? 'text-lg md:text-xl' : 'text-base'">
              {{ b.title }}
            </h3>
            <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {{ b.desc }}
            </p>
          </div>
        </article>
      </div>
    </section>

    <!-- 为什么选择：两列极简列表，无卡片 -->
    <section
      class="mx-auto max-w-6xl px-5 py-20 md:py-24 border-t border-zinc-200/70 dark:border-zinc-800/70"
      v-reveal
    >
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
        <div class="lg:col-span-4">
          <h2 class="text-2xl md:text-4xl font-bold tracking-tight">为什么选择 XZJI</h2>
          <p class="mt-4 text-sm md:text-base text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-[36ch]">
            为下载站场景而生，把运营、变现与安全收进一套系统。
          </p>
        </div>
        <div class="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-8">
          <div v-for="r in reasons" :key="r.title" class="flex items-start gap-4">
            <span
              class="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100/80 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            >
              <NIcon :component="r.icon" size="19" />
            </span>
            <div>
              <h3 class="font-semibold">{{ r.title }}</h3>
              <p class="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {{ r.desc }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 购买流程：横向连接步骤 -->
    <section
      class="mx-auto max-w-6xl px-5 py-20 md:py-24 border-t border-zinc-200/70 dark:border-zinc-800/70"
      v-reveal
    >
      <div class="mb-12 max-w-2xl">
        <h2 class="text-2xl md:text-4xl font-bold tracking-tight">三步完成购买</h2>
        <p class="mt-4 text-sm md:text-base text-zinc-500 dark:text-zinc-400">
          全程自动化，支付成功即获授权码。
        </p>
      </div>
      <div class="relative grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
        <div
          class="hidden md:block absolute top-6 left-[12%] right-[12%] h-px bg-gradient-to-r from-emerald-500/0 via-emerald-500/40 to-emerald-500/0"
          aria-hidden="true"
        ></div>
        <div v-for="s in steps" :key="s.title" class="relative">
          <span
            class="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white dark:bg-zinc-950 border border-emerald-300/60 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 relative z-10 shadow-sm"
          >
            <NIcon :component="s.icon" size="22" />
          </span>
          <h3 class="mt-5 text-lg font-semibold">{{ s.title }}</h3>
          <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-[34ch]">
            {{ s.desc }}
          </p>
        </div>
      </div>
    </section>

    <!-- 常见问题：编辑部式分割线列表 -->
    <section
      id="faq"
      class="mx-auto max-w-3xl px-5 py-20 md:py-24 border-t border-zinc-200/70 dark:border-zinc-800/70"
      v-reveal
    >
      <div class="mb-10">
        <h2 class="text-2xl md:text-4xl font-bold tracking-tight">常见问题</h2>
      </div>
      <div class="divide-y divide-zinc-200/80 dark:divide-zinc-800/80 border-y border-zinc-200/80 dark:border-zinc-800/80">
        <div v-for="(f, i) in faqs" :key="i">
          <button
            @click="toggleFaq(i)"
            class="w-full flex items-center justify-between gap-4 py-5 text-left group"
            :aria-expanded="openFaq === i"
          >
            <span
              class="text-sm md:text-base font-medium transition-colors"
              :class="openFaq === i ? 'text-emerald-600 dark:text-emerald-400' : 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400'"
              >{{ f.q }}</span
            >
            <NIcon
              :component="openFaq === i ? Minus : Plus"
              size="18"
              class="shrink-0 text-zinc-400"
            />
          </button>
          <div
            v-show="openFaq === i"
            class="pb-5 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-[62ch]"
          >
            {{ f.a }}
          </div>
        </div>
      </div>
    </section>

    <!-- 底部 CTA：辉光渐变面板 -->
    <section class="mx-auto max-w-6xl px-5 pb-24" v-reveal>
      <div
        class="relative overflow-hidden rounded-3xl border border-emerald-300/50 dark:border-emerald-500/25 px-8 py-16 md:py-20 text-center bg-gradient-to-b from-emerald-50/90 to-white dark:from-emerald-500/[0.07] dark:to-zinc-950"
      >
        <div
          class="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[560px] rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/15"
          aria-hidden="true"
        ></div>
        <div class="relative">
          <NIcon
            :component="Bolt"
            size="28"
            class="text-emerald-600 dark:text-emerald-400"
          />
          <h2 class="mt-4 text-2xl md:text-4xl font-bold tracking-tight">
            准备好搭建你的资源下载站了吗
          </h2>
          <p class="mt-4 text-sm md:text-base text-zinc-600 dark:text-zinc-400">
            购买授权，绑定域名，即刻上线运营。
          </p>
          <a
            href="#pricing"
            class="mt-8 inline-flex items-center gap-1.5 px-7 py-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-medium text-sm transition shadow-lg shadow-emerald-600/25"
          >
            查看授权方案
            <NIcon :component="ArrowRight" class="text-[15px]" />
          </a>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* hero 网格纹理：emerald 低透明度线条，顶部椭圆遮罩渐隐 */
.hero-grid {
  background-image:
    linear-gradient(to right, rgb(16 185 129 / 0.06) 1px, transparent 1px),
    linear-gradient(to bottom, rgb(16 185 129 / 0.06) 1px, transparent 1px);
  background-size: 44px 44px;
  -webkit-mask-image: radial-gradient(ellipse 90% 70% at 55% 0%, black 25%, transparent 72%);
  mask-image: radial-gradient(ellipse 90% 70% at 55% 0%, black 25%, transparent 72%);
}
</style>
