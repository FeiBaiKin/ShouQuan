'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ExternalLink,
  Info,
  LifeBuoy,
  Package,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import gsap from 'gsap'
import { storefrontApi } from '@/lib/api'
import type { Product, PricingPlan } from '@/lib/types'
import { getProductContent } from '@/content/products'
import { usePageMotion, buildReveals, buildGridStagger } from '@/lib/motion'
import { AmbientBackdrop } from '@/components/storefront/ambient-backdrop'
import { BrowserFrame } from '@/components/storefront/browser-frame'
import { SearchTyper } from '@/components/storefront/search-typer'
import { KeywordMarquee } from '@/components/storefront/keyword-marquee'
import { SectionHead } from '@/components/storefront/section-head'
import { GlowCard } from '@/components/storefront/glow-card'
import { PlanCards } from '@/components/storefront/plan-cards'
import { StepFlow } from '@/components/storefront/step-flow'
import { FaqAccordion } from '@/components/storefront/faq-accordion'

const specs = [
  { label: '交付', value: '即时发码', mono: false },
  { label: '签名', value: 'Ed25519', mono: true },
  { label: '完整性', value: 'SHA256', mono: true },
  { label: '离线', value: '心跳宽限', mono: false },
]
const defaultNotices = [
  { icon: ShieldCheck, title: '正版', desc: '域名绑定激活，同域重装可复用。' },
  { icon: RefreshCw, title: '更新', desc: '有效期内免费升级。' },
  { icon: Info, title: '不退', desc: '虚拟商品，激活不退。' },
  { icon: LifeBuoy, title: '售后', desc: '部署、换绑可联系。' },
]

function bentoSpan(i: number) {
  return i < 2 ? 'lg:col-span-3' : 'lg:col-span-2'
}

function ProductSalesInner() {
  const searchParams = useSearchParams()
  const slug = searchParams.get('slug') || ''
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme !== 'light'

  const [product, setProduct] = useState<Product | null>(null)
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [latestVersion, setLatestVersion] = useState('')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [ready, setReady] = useState(false)

  const pageEl = useRef<HTMLDivElement | null>(null)
  const content = getProductContent(slug)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    setProduct(null)
    setReady(false)
    window.scrollTo({ top: 0 })

    storefrontApi
      .product(slug)
      .then(({ data }) => {
        if (cancelled) return
        setProduct(data.product)
        setPlans(data.plans)
        setLatestVersion(data.latest_version)
        document.title = `${data.product.name} · 授权中心`
      })
      .catch(() => {
        if (cancelled) return
        setNotFound(true)
        document.title = '未找到 · 授权中心'
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  usePageMotion(
    pageEl,
    (root) => {
      gsap.timeline({ defaults: { ease: 'expo.out' } }).to('[data-hero]', {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.9,
        stagger: 0.09,
        delay: 0.05,
      })
      const tilt = root.querySelector('[data-tilt]')
      if (tilt) {
        gsap.to('[data-tilt-fade]', { opacity: 1, duration: 1, ease: 'expo.out', delay: 0.5 })
        gsap.fromTo(
          tilt,
          { rotateX: 14, scale: 0.94, y: 30 },
          {
            rotateX: 0,
            scale: 1,
            y: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: '[data-tilt-wrap]',
              start: 'top 88%',
              end: 'top 28%',
              scrub: 0.5,
            },
          },
        )
      }
      gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((el) => {
        gsap.to(el, {
          yPercent: -8,
          ease: 'none',
          scrollTrigger: { trigger: el.parentElement, scrub: 0.6 },
        })
      })
      buildReveals(root)
      buildGridStagger(root, '[data-stagger-grid]', '[data-stagger]')
    },
    [ready, slug],
  )

  const themedShot = (src: string) => {
    if (!isDark && src.endsWith('.png') && !src.includes('-light')) {
      return src.replace(/\.png$/, '-light.png')
    }
    return src
  }

  const heroImage = content?.hero.image ? themedShot(content.hero.image) : null
  const showcaseImages = (content?.showcase || []).map((s) => ({ ...s, image: themedShot(s.image) }))
  const keywords = useMemo(() => {
    const ks = content?.keywords
    if (ks?.length) return ks
    return (content?.features || []).map((f) => f.title)
  }, [content])
  const marqueeSplit = useMemo(() => {
    const half = Math.ceil(keywords.length / 2)
    return [keywords.slice(0, half), keywords.length > 5 ? keywords.slice(half) : keywords]
  }, [keywords])
  const demoHost = content?.demoUrl?.replace(/^https?:\/\//, '')
  const startingPrice = plans.length ? Math.min(...plans.map((p) => p.price)) : null

  const goBuy = (planId: number) => router.push(`/buy?plan=${planId}`)

  if (loading) {
    return (
      <div className="mx-auto max-w-[1200px] space-y-8 px-5 pb-24 pt-20">
        <div className="mx-auto h-8 w-40 animate-pulse rounded-full bg-[color:var(--fx-card)]" />
        <div className="mx-auto h-20 w-2/3 max-w-xl animate-pulse rounded-2xl bg-[color:var(--fx-card)]" />
        <div className="fx-glass h-96 animate-pulse !rounded-3xl" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="relative mx-auto max-w-[1200px] px-5 py-32 text-center">
        <Package size={44} className="mx-auto text-[color:var(--sf-muted)]" />
        <h1 className="fx-display mt-6 text-3xl font-bold tracking-tight text-[color:var(--sf-ink)]">
          没有这个产品
        </h1>
        <p className="mt-3 text-sm text-[color:var(--sf-muted)]">
          链接可能已失效，回目录看看在售产品。
        </p>
        <Link href="/" className="fx-btn fx-btn-primary mt-9">
          回产品目录
        </Link>
      </div>
    )
  }

  if (!product) return null

  // ===== 内容包驱动的完整产品页 =====
  if (content) {
    return (
      <div key={product.slug} ref={pageEl} className="relative overflow-x-clip">
        {/* Hero */}
        <section className="relative">
          <AmbientBackdrop />
          <div className="relative mx-auto max-w-[1200px] px-5 pt-16 text-center md:pt-24">
            <div data-hero className="flex flex-wrap items-center justify-center gap-2.5">
              <span className="fx-chip fx-chip-accent">{content.hero.badge}</span>
              {latestVersion && (
                <span className="fx-chip fx-mono !text-[11px]">v{latestVersion}</span>
              )}
            </div>

            <h1
              data-hero="blur"
              className="fx-display mx-auto mt-7 max-w-[16ch] text-[2.7rem] font-bold leading-[1.07] tracking-tight text-[color:var(--sf-ink)] md:text-[4.2rem]"
            >
              {content.hero.titleTop}
              <span className="fx-gradient-text">{content.hero.titleHighlight}</span>
              {content.hero.titleBottom}
            </h1>

            <p
              data-hero
              className="mx-auto mt-6 max-w-[40ch] text-[15px] leading-[1.85] text-[color:var(--sf-muted)] md:text-[16px]"
            >
              {content.hero.subtitle}
            </p>

            {keywords.length > 0 && (
              <div data-hero className="mx-auto mt-9 max-w-[460px]">
                <SearchTyper keywords={keywords} />
              </div>
            )}

            <div data-hero className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
              <a href="#pricing" className="fx-btn fx-btn-primary fx-btn-lg">
                {content.hero.primaryCta}
                <ChevronDown size={16} />
              </a>
              {content.demoUrl && (
                <a
                  href={content.demoUrl}
                  target="_blank"
                  rel="noopener"
                  className="fx-btn fx-btn-ghost fx-btn-lg"
                >
                  打开演示站
                  <ArrowUpRight size={15} />
                </a>
              )}
            </div>

            {startingPrice !== null && (
              <p data-hero className="fx-mono mt-6 text-[12px] text-[color:var(--sf-muted)]">
                授权自{' '}
                <span className="tnum font-bold text-[color:var(--fx-accent)]">
                  ¥{startingPrice}
                </span>{' '}
                起 · 付款即发码
              </p>
            )}
          </div>

          {/* 主截图：透视扶正 */}
          <div
            data-tilt-wrap
            className="relative mx-auto max-w-[1080px] px-5 pb-10 pt-14 md:pb-16"
            style={{ perspective: '1400px' }}
          >
            <div
              className="absolute inset-x-10 bottom-4 -z-10 h-1/2 rounded-full opacity-70 blur-3xl"
              style={{
                background: 'radial-gradient(closest-side, var(--fx-aurora-a), transparent)',
              }}
              aria-hidden="true"
            />
            {heroImage && (
              <div
                data-tilt
                data-tilt-fade
                className="opacity-0 will-change-transform"
                style={{ transformOrigin: 'center top' }}
              >
                <BrowserFrame
                  src={heroImage}
                  alt={content.hero.imageAlt}
                  url={demoHost}
                  aspect="16/9.5"
                  eager
                />
              </div>
            )}
          </div>
        </section>

        {/* 关键词跑马灯 */}
        {keywords.length >= 4 && (
          <section className="border-y border-[color:var(--fx-card-line)] py-6">
            <KeywordMarquee words={marqueeSplit[0]} duration={46} />
            <div className="mt-3">
              <KeywordMarquee words={marqueeSplit[1]} reverse duration={38} />
            </div>
          </section>
        )}

        {/* 机制硬指标 */}
        <section className="mx-auto max-w-[1200px] px-5 pt-14 md:pt-20">
          <div data-stagger-grid className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {specs.map((s) => (
              <div key={s.label} data-stagger className="fx-glass !rounded-2xl px-6 py-5">
                <p className="fx-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--sf-muted)]">
                  {s.label}
                </p>
                <p
                  className={`mt-2 text-[17px] font-bold text-[color:var(--sf-ink)] ${s.mono ? 'fx-mono' : 'fx-display'}`}
                >
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Features Bento */}
        {content.features.length > 0 && (
          <section className="mx-auto max-w-[1200px] px-5 pt-16 md:pt-24">
            <SectionHead
              kicker="Features"
              title={content.featuresTitle || '开箱即用的完整能力'}
              sub={content.featuresSub || '从关键词到收款，一套程序全部搞定。'}
            />
            <div
              data-stagger-grid
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6"
            >
              {content.features.map((f, i) => {
                const Icon = f.icon
                return (
                  <GlowCard
                    key={f.title}
                    className={`flex flex-col p-6 ${bentoSpan(i)} ${i < 2 ? 'md:p-8' : ''}`}
                  >
                    <div data-stagger className="flex h-full flex-col">
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center justify-center rounded-2xl text-[color:var(--fx-accent)] ${i < 2 ? 'h-12 w-12' : 'h-10 w-10'}`}
                          style={{
                            background: 'color-mix(in srgb, var(--fx-accent) 12%, transparent)',
                          }}
                        >
                          <Icon size={i < 2 ? 22 : 19} />
                        </span>
                        <span className="fx-mono text-[10px] text-[color:var(--sf-muted)]">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <h3
                        className={`fx-display mt-5 font-bold text-[color:var(--sf-ink)] ${i < 2 ? 'text-[17px]' : 'text-[15px]'}`}
                      >
                        {f.title}
                      </h3>
                      <p className="mt-2 flex-1 text-[13px] leading-relaxed text-[color:var(--sf-muted)]">
                        {f.desc}
                      </p>
                    </div>
                  </GlowCard>
                )
              })}
            </div>
          </section>
        )}

        {/* Showcase */}
        {showcaseImages.map((s, i) => (
          <section key={s.title} className="mx-auto max-w-[1200px] px-5 pt-20 md:pt-28">
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
              <div data-reveal className={`lg:col-span-4 ${i % 2 === 1 ? 'lg:order-2' : ''}`}>
                <p className="fx-kicker">{s.kicker}</p>
                <h2 className="fx-display mt-3 text-[1.7rem] font-bold leading-tight tracking-tight text-[color:var(--sf-ink)] md:text-[2.2rem]">
                  {s.title}
                </h2>
                <p className="mt-4 text-[14px] leading-[1.85] text-[color:var(--sf-muted)]">
                  {s.desc}
                </p>
                <ul className="mt-7 space-y-3">
                  {s.points.map((pt) => (
                    <li
                      key={pt}
                      className="flex items-start gap-2.5 text-[13.5px] text-[color:var(--sf-ink)]"
                    >
                      <span
                        className="mt-0.5 inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full"
                        style={{
                          background: 'color-mix(in srgb, var(--fx-accent) 15%, transparent)',
                        }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--fx-accent)]" />
                      </span>
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
              <div
                data-reveal="scale"
                className={`lg:col-span-8 ${i % 2 === 1 ? 'lg:order-1' : ''}`}
              >
                <div data-parallax>
                  <BrowserFrame src={s.image} alt={s.imageAlt} url={demoHost} aspect="16/10" />
                </div>
              </div>
            </div>
          </section>
        ))}

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-[1200px] scroll-mt-24 px-5 pt-20 md:pt-28">
          <SectionHead center kicker="Pricing" title="授权方案" sub="域名绑定激活，授权期内免费升级。" />
          <PlanCards plans={plans} onBuy={goBuy} />

          {content.notices.length > 0 && (
            <div
              data-stagger-grid
              className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              {content.notices.map((n) => {
                const Icon = n.icon
                return (
                  <div
                    key={n.title}
                    data-stagger
                    className="fx-glass flex gap-3.5 !rounded-2xl px-5 py-4"
                  >
                    <Icon size={18} className="mt-0.5 shrink-0 text-[color:var(--fx-accent)]" />
                    <div>
                      <p className="text-[13px] font-semibold text-[color:var(--sf-ink)]">
                        {n.title}
                      </p>
                      <p className="mt-1 text-[12px] leading-relaxed text-[color:var(--sf-muted)]">
                        {n.desc}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Steps */}
        {content.steps.length > 0 && (
          <section className="mx-auto max-w-[1200px] px-5 pt-20 md:pt-28">
            <SectionHead center kicker="How to buy" title={content.stepsTitle} sub={content.stepsSub} />
            <StepFlow steps={content.steps} />
          </section>
        )}

        {/* FAQ */}
        {content.faqs.length > 0 && (
          <section id="faq" className="mx-auto max-w-[780px] px-5 pt-20 md:pt-28">
            <SectionHead center kicker="FAQ" title="常见问题" />
            <FaqAccordion faqs={content.faqs} />
          </section>
        )}

        {/* Final CTA */}
        <section className="mx-auto max-w-[1200px] px-5 pb-24 pt-20 md:pt-28">
          <div
            data-reveal="scale"
            className="fx-glass relative overflow-hidden !rounded-3xl px-8 py-16 text-center md:py-20"
          >
            <AmbientBackdrop noGrid />
            <div className="relative">
              <p className="fx-kicker">Get started</p>
              <h2 className="fx-display mx-auto mt-4 max-w-[22ch] text-[1.9rem] font-bold leading-[1.15] tracking-tight text-[color:var(--sf-ink)] md:text-[2.6rem]">
                {content.finalCta.title}
              </h2>
              <p className="mx-auto mt-4 max-w-[36ch] text-[14px] leading-relaxed text-[color:var(--sf-muted)]">
                {content.finalCta.sub}
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
                <a href="#pricing" className="fx-btn fx-btn-primary fx-btn-lg">
                  {content.finalCta.button}
                  <ArrowRight size={16} />
                </a>
                {content.demoUrl && (
                  <a
                    href={content.demoUrl}
                    target="_blank"
                    rel="noopener"
                    className="fx-btn fx-btn-ghost fx-btn-lg"
                  >
                    先看演示
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    )
  }

  // ===== 通用 fallback（未登记内容包的产品） =====
  return (
    <div ref={pageEl} className="relative overflow-x-clip">
      <section className="relative">
        <AmbientBackdrop />
        <div className="relative mx-auto max-w-[1200px] px-5 pb-16 pt-20 text-center md:pt-28">
          <span data-hero className="fx-chip fx-chip-accent fx-mono !text-[11px]">
            {product.slug}
          </span>
          <h1
            data-hero="blur"
            className="fx-display mx-auto mt-6 max-w-[18ch] text-[2.5rem] font-bold leading-[1.1] tracking-tight text-[color:var(--sf-ink)] md:text-[3.4rem]"
          >
            {product.name}
          </h1>
          <p
            data-hero
            className="mx-auto mt-5 max-w-[46ch] text-[15px] leading-[1.85] text-[color:var(--sf-muted)]"
          >
            {product.remark || '域名绑定激活，授权期内免费升级。'}
          </p>
          <div data-hero className="mt-9">
            <a href="#pricing" className="fx-btn fx-btn-primary fx-btn-lg">
              查看授权方案
              <ChevronDown size={16} />
            </a>
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-[1200px] scroll-mt-24 px-5 pb-24">
        <SectionHead center kicker="Pricing" title="授权方案" />
        <PlanCards plans={plans} onBuy={goBuy} />
        <div
          data-stagger-grid
          className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {defaultNotices.map((n) => {
            const Icon = n.icon
            return (
              <div key={n.title} data-stagger className="fx-glass flex gap-3.5 !rounded-2xl px-5 py-4">
                <Icon size={18} className="mt-0.5 shrink-0 text-[color:var(--fx-accent)]" />
                <div>
                  <p className="text-[13px] font-semibold text-[color:var(--sf-ink)]">{n.title}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-[color:var(--sf-muted)]">
                    {n.desc}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

export default function ProductSalesPage() {
  return (
    <Suspense fallback={null}>
      <ProductSalesInner />
    </Suspense>
  )
}
