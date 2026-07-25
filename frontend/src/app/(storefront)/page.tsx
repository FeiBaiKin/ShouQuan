'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import {
  ArrowRight,
  ArrowUpRight,
  Zap,
  ChevronDown,
  ExternalLink,
  Fingerprint,
  Mail,
  Package,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import gsap from 'gsap'
import { storefrontApi, extractError } from '@/lib/api'
import type { StorefrontProduct } from '@/lib/types'
import { getProductContent } from '@/content/products'
import { usePageMotion, buildReveals, buildGridStagger } from '@/lib/motion'
import { AmbientBackdrop } from '@/components/storefront/ambient-backdrop'
import { BrowserFrame } from '@/components/storefront/browser-frame'
import { GlowCard } from '@/components/storefront/glow-card'
import { SectionHead } from '@/components/storefront/section-head'

const trustItems = [
  { icon: Mail, label: '即时发码' },
  { icon: Fingerprint, label: 'Ed25519 签名' },
  { icon: ShieldCheck, label: 'SHA256 校验' },
  { icon: RefreshCw, label: '在线升级' },
]
const trustBorders = [
  'border-b border-r md:border-b-0',
  'border-b md:border-b-0 md:border-r',
  'border-r',
  '',
]
const mechanisms = [
  { icon: Mail, title: '即时发码', desc: '付款成功，授权码直达邮箱，全程无人工等待。' },
  { icon: ShieldCheck, title: '域名绑定', desc: '一码一域激活，同域重装免费复用。' },
  { icon: Fingerprint, title: '离线校验', desc: 'Ed25519 本地签名验证，断网有心跳宽限。' },
  { icon: RefreshCw, title: '在线升级', desc: '授权期内后台一键更新，SHA256 完整性校验。' },
]

export default function PortalPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme !== 'light'

  const [products, setProducts] = useState<StorefrontProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  const pageEl = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    storefrontApi
      .products()
      .then(({ data }) => setProducts(data))
      .catch((e) => setError(extractError(e)))
      .finally(() => {
        setLoading(false)
        setReady(true)
      })
  }, [])

  usePageMotion(
    pageEl,
    (root) => {
      gsap.timeline({ defaults: { ease: 'expo.out' } }).to('[data-hero]', {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.9,
        stagger: 0.09,
        delay: 0.08,
      })
      gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((el) => {
        gsap.to(el, {
          yPercent: -7,
          ease: 'none',
          scrollTrigger: { trigger: el.parentElement, scrub: 0.6 },
        })
      })
      buildReveals(root)
      buildGridStagger(root, '[data-stagger-grid]', '[data-stagger]')
    },
    [ready],
  )

  const contentOf = (p: StorefrontProduct) => getProductContent(p.slug)
  const taglineOf = (p: StorefrontProduct) =>
    contentOf(p)?.tagline || p.remark || '域名绑定激活，授权期内免费升级。'
  const themedShot = (src: string | null | undefined) => {
    if (!src) return null
    if (!isDark && src.endsWith('.png') && !src.includes('-light')) {
      return src.replace(/\.png$/, '-light.png')
    }
    return src
  }
  const cardImageOf = (p: StorefrontProduct) => themedShot(contentOf(p)?.cardImage)
  const demoOf = (p: StorefrontProduct) => contentOf(p)?.demoUrl ?? null
  const demoHostOf = (p: StorefrontProduct) => demoOf(p)?.replace(/^https?:\/\//, '')
  const fromPrice = (p: StorefrontProduct) => {
    const prices = p.plans.map((pl) => pl.price)
    return prices.length ? Math.min(...prices) : null
  }

  const single = products.length === 1 ? products[0] : null
  const heroDemo = single ? demoOf(single) : null

  return (
    <div ref={pageEl} className="relative overflow-x-clip">
      {/* ============ Hero ============ */}
      <section className="relative">
        <AmbientBackdrop />
        <div className="relative mx-auto max-w-[1200px] px-5 pb-16 pt-20 text-center md:pb-20 md:pt-28">
          <div data-hero className="flex flex-wrap items-center justify-center gap-2.5">
            <span className="fx-chip fx-chip-accent">
              <Zap size={13} />
              正版授权 · 即时发码
            </span>
            {products.length > 0 && (
              <span className="fx-chip">{products.length} 款产品在售</span>
            )}
          </div>

          <h1
            data-hero="blur"
            className="fx-display mx-auto mt-8 max-w-[15ch] text-[2.8rem] font-bold leading-[1.08] tracking-tight text-[color:var(--sf-ink)] md:text-[4.4rem]"
          >
            我们做的软件，
            <br />
            在这里<span className="fx-gradient-text">发授权</span>
          </h1>

          <p
            data-hero
            className="mx-auto mt-7 max-w-[44ch] text-[15px] leading-[1.85] text-[color:var(--sf-muted)] md:text-[16px]"
          >
            域名绑定激活，付款后授权即时生效。授权期内在线升级，不等人工、不跑流程。
          </p>

          <div data-hero className="mt-10 flex flex-wrap items-center justify-center gap-3.5">
            <a href="#products" className="fx-btn fx-btn-primary fx-btn-lg">
              逛在售产品
              <ChevronDown size={16} />
            </a>
            {heroDemo && (
              <a
                href={heroDemo}
                target="_blank"
                rel="noopener"
                className="fx-btn fx-btn-ghost fx-btn-lg"
              >
                打开演示站
                <ArrowUpRight size={15} />
              </a>
            )}
          </div>

          <div data-hero className="mx-auto mt-14 max-w-[760px]">
            <div className="fx-glass grid grid-cols-2 overflow-hidden !rounded-2xl md:grid-cols-4">
              {trustItems.map((t, i) => {
                const Icon = t.icon
                return (
                  <div
                    key={t.label}
                    className={`flex items-center justify-center gap-2.5 border-[color:var(--fx-card-line)] px-4 py-4 ${trustBorders[i]}`}
                  >
                    <Icon size={16} className="shrink-0 text-[color:var(--fx-accent)]" />
                    <span className="fx-mono text-[11.5px] font-semibold tracking-[0.06em] text-[color:var(--sf-muted)]">
                      {t.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ============ Loading / Error / Empty ============ */}
      {loading ? (
        <section className="mx-auto max-w-[1200px] px-5 pb-24">
          <div className="fx-glass h-72 animate-pulse !rounded-3xl" />
        </section>
      ) : error ? (
        <section className="mx-auto max-w-[1200px] px-5 pb-24 pt-8 text-center text-red-500">
          {error}
        </section>
      ) : !products.length ? (
        <section className="mx-auto max-w-[1200px] px-5 pb-28 pt-8 text-center">
          <Package size={42} className="mx-auto text-[color:var(--sf-muted)]" />
          <p className="mt-5 text-sm text-[color:var(--sf-muted)]">产品即将上架，敬请期待。</p>
        </section>
      ) : (
        <>
          {/* ============ Products ============ */}
          <section id="products" className="scroll-mt-24">
            <div className="mx-auto max-w-[1200px] px-5 pb-8 pt-6 md:pt-10">
              <SectionHead
                kicker="Products"
                title="在售产品"
                sub="每一款都带完整授权系统：发码、绑定、升级，开箱即用。"
              />

              <div className="space-y-8">
                {products.map((p, idx) => (
                  <article
                    key={p.id}
                    data-reveal
                    className="fx-glass grid grid-cols-1 overflow-hidden !rounded-3xl lg:grid-cols-12"
                  >
                    {/* 信息 */}
                    <div
                      className={`flex flex-col p-8 md:p-10 lg:col-span-5 ${idx % 2 === 1 ? 'lg:order-2' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3.5">
                          <span
                            className="fx-display inline-flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-[color:var(--fx-accent-ink)] shadow-[var(--fx-glow-sm)]"
                            style={{ background: 'var(--fx-gradient)' }}
                          >
                            {p.name.slice(0, 1)}
                          </span>
                          <div>
                            <h3 className="fx-display text-xl font-bold tracking-tight text-[color:var(--sf-ink)] md:text-2xl">
                              {p.name}
                            </h3>
                            {p.latest_version && (
                              <p className="fx-mono mt-0.5 text-[11px] text-[color:var(--sf-muted)]">
                                v{p.latest_version}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="fx-mono hidden text-[11px] text-[color:var(--sf-muted)] sm:block">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                      </div>

                      <p className="mt-6 flex-1 text-[14px] leading-[1.85] text-[color:var(--sf-muted)]">
                        {taglineOf(p)}
                      </p>

                      <dl className="mt-8 grid grid-cols-2 gap-x-4 gap-y-5 text-[13px]">
                        <div>
                          <dt className="text-[11px] text-[color:var(--sf-muted)]">起步价</dt>
                          <dd className="fx-display tnum mt-1 text-2xl font-bold text-[color:var(--sf-ink)]">
                            {fromPrice(p) !== null ? `¥${fromPrice(p)}` : '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-[color:var(--sf-muted)]">交付</dt>
                          <dd className="mt-1 font-semibold text-[color:var(--sf-ink)]">付款即发码</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-[color:var(--sf-muted)]">授权</dt>
                          <dd className="mt-1 font-semibold text-[color:var(--sf-ink)]">单域名绑定</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-[color:var(--sf-muted)]">更新</dt>
                          <dd className="mt-1 font-semibold text-[color:var(--sf-ink)]">在线升级</dd>
                        </div>
                      </dl>

                      <div className="mt-9 flex flex-wrap gap-3">
                        <Link href={`/product?slug=${p.slug}`} className="fx-btn fx-btn-primary">
                          看详情
                          <ArrowRight size={15} />
                        </Link>
                        {demoOf(p) && (
                          <a
                            href={demoOf(p)!}
                            target="_blank"
                            rel="noopener"
                            className="fx-btn fx-btn-ghost"
                          >
                            演示
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* 截图 */}
                    <div
                      className={`relative min-h-[280px] overflow-hidden border-t border-[color:var(--fx-card-line)] p-6 pb-0 md:p-10 md:pb-0 lg:col-span-7 lg:border-t-0 ${idx % 2 === 1 ? 'lg:order-1 lg:border-r' : 'lg:border-l'}`}
                    >
                      <div
                        className="absolute inset-0 -z-0 opacity-70"
                        style={{
                          background:
                            'radial-gradient(80% 60% at 50% 100%, var(--fx-aurora-a), transparent)',
                        }}
                        aria-hidden="true"
                      />
                      {cardImageOf(p) && (
                        <div data-parallax className="relative translate-y-2">
                          <BrowserFrame
                            src={cardImageOf(p)!}
                            alt={`${p.name} 界面预览`}
                            url={demoHostOf(p)}
                            aspect="16/10"
                            eager
                          />
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* ============ Mechanism ============ */}
          <section className="mx-auto max-w-[1200px] px-5 pb-8 pt-16 md:pt-24">
            <SectionHead
              center
              kicker="Mechanism"
              title="授权这件事，做到全自动"
              sub="从付款、发码、激活到升级，每一步都由系统完成，可靠且可验证。"
            />
            <div
              data-stagger-grid
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              {mechanisms.map((m) => {
                const Icon = m.icon
                return (
                  <GlowCard key={m.title} className="p-7">
                    <div data-stagger>
                      <span
                        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-[color:var(--fx-accent)]"
                        style={{ background: 'color-mix(in srgb, var(--fx-accent) 12%, transparent)' }}
                      >
                        <Icon size={22} />
                      </span>
                      <h3 className="fx-display mt-5 text-[16px] font-bold text-[color:var(--sf-ink)]">
                        {m.title}
                      </h3>
                      <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--sf-muted)]">
                        {m.desc}
                      </p>
                    </div>
                  </GlowCard>
                )
              })}
            </div>
          </section>

          {/* ============ Final CTA ============ */}
          <section className="mx-auto max-w-[1200px] px-5 pb-24 pt-16 md:pt-20">
            <div
              data-reveal="scale"
              className="fx-glass relative overflow-hidden !rounded-3xl px-8 py-16 text-center md:py-20"
            >
              <AmbientBackdrop noGrid />
              <div className="relative">
                <p className="fx-kicker">Ready?</p>
                <h2 className="fx-display mx-auto mt-4 max-w-[24ch] text-[1.9rem] font-bold leading-[1.15] tracking-tight text-[color:var(--sf-ink)] md:text-[2.6rem]">
                  选一款，<span className="fx-gradient-text">今天就上线</span>
                </h2>
                <p className="mx-auto mt-4 max-w-[40ch] text-[14px] leading-relaxed text-[color:var(--sf-muted)]">
                  付款到收码不超过一分钟，部署有文档，卡住了随时找我们。
                </p>
                <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
                  {single ? (
                    <Link
                      href={`/product?slug=${single.slug}`}
                      className="fx-btn fx-btn-primary fx-btn-lg"
                    >
                      查看 {single.name}
                      <ArrowRight size={16} />
                    </Link>
                  ) : (
                    <a href="#products" className="fx-btn fx-btn-primary fx-btn-lg">
                      挑一款产品
                      <ArrowRight size={16} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
