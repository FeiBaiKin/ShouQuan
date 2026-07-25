'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { PointerEvent } from 'react'
import { Zap, Check } from 'lucide-react'
import gsap from 'gsap'
import { parseFeatures, type PricingPlan } from '@/lib/types'
import { prefersReducedMotion } from '@/lib/motion'

/**
 * 授权方案卡：推荐档渐变描边 + 光晕 + 微放大；价格进入视口时数字滚动；追光 hover。
 */
export function PlanCards({
  plans,
  onBuy,
}: {
  plans: PricingPlan[]
  onBuy: (planId: number) => void
}) {
  const featuredIdx = useMemo(() => {
    const permanentIdx = plans.findIndex((p) => p.duration_type === 'permanent')
    if (permanentIdx >= 0) return permanentIdx
    if (plans.length >= 3) return 1
    return 0
  }, [plans])

  const rootEl = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (prefersReducedMotion() || !rootEl.current) return
    const els = rootEl.current.querySelectorAll<HTMLElement>('[data-price]')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const el = entry.target as HTMLElement
          const target = Number(el.dataset.price ?? 0)
          const counter = { v: 0 }
          gsap.to(counter, {
            v: target,
            duration: 1.1,
            ease: 'expo.out',
            onUpdate: () => {
              el.textContent = String(Math.round(counter.v))
            },
          })
          observer.unobserve(el)
        })
      },
      { threshold: 0.4 },
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [plans])

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`)
    el.style.setProperty('--my', `${e.clientY - rect.top}px`)
  }

  function durationLabel(t: string, days: number): string {
    if (t === 'permanent') return '买断 · 永久使用'
    if (t === 'yearly') return '365 天授权'
    return `${days} 天授权`
  }

  function featuresOf(plan: PricingPlan): string[] {
    const fs = parseFeatures(plan.features)
    return fs.length ? fs : ['商业授权 + 全功能']
  }

  if (!plans.length) {
    return (
      <div className="py-14 text-center text-sm text-[color:var(--sf-muted)]">套餐即将上架。</div>
    )
  }

  return (
    <div
      ref={rootEl}
      data-stagger-grid
      className={`mx-auto grid grid-cols-1 items-stretch gap-5 ${
        plans.length === 1
          ? 'max-w-sm'
          : plans.length === 2
            ? 'max-w-3xl md:grid-cols-2'
            : 'md:grid-cols-3'
      }`}
    >
      {plans.map((plan, idx) => (
        <div
          key={plan.id}
          data-stagger
          className={`fx-spot-card relative flex flex-col rounded-3xl p-7 transition-transform duration-300 ${
            idx === featuredIdx
              ? 'fx-gborder !overflow-visible shadow-[var(--fx-glow)] lg:scale-[1.03] lg:hover:scale-[1.05]'
              : 'fx-glass hover:-translate-y-1'
          }`}
          onPointerMove={onMove}
        >
          {idx === featuredIdx && plans.length > 1 && (
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-3.5 py-1 text-[11px] font-bold text-[color:var(--fx-accent-ink)] shadow-[var(--fx-glow-sm)]"
                style={{ background: 'var(--fx-gradient)' }}
              >
                <Zap size={12} />
                最多人选
              </span>
            </div>
          )}

          <p className="fx-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--sf-muted)]">
            {plan.name}
          </p>

          <div className="mt-5 flex items-baseline gap-1.5">
            <span className="text-[15px] font-semibold text-[color:var(--sf-muted)]">¥</span>
            <span
              className="fx-display tnum text-[3rem] font-bold leading-none tracking-tight text-[color:var(--sf-ink)]"
              data-price={plan.price}
            >
              {plan.price}
            </span>
          </div>
          <p className="mt-2.5 text-[12.5px] text-[color:var(--sf-muted)]">
            {durationLabel(plan.duration_type, plan.duration_days)}
          </p>

          <div className="my-6 h-px bg-gradient-to-r from-[color:var(--fx-card-line)] via-[color:var(--fx-card-line)] to-transparent" />

          <ul className="flex-1 space-y-3 text-[13.5px]">
            {featuresOf(plan).map((f, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full"
                  style={{ background: 'color-mix(in srgb, var(--fx-accent) 15%, transparent)' }}
                >
                  <Check size={12} className="text-[color:var(--fx-accent)]" />
                </span>
                <span className="leading-relaxed text-[color:var(--sf-muted)]">{f}</span>
              </li>
            ))}
          </ul>

          <button
            className={`fx-btn mt-8 w-full ${idx === featuredIdx ? 'fx-btn-primary' : 'fx-btn-ghost'}`}
            onClick={() => onBuy(plan.id)}
          >
            立即购买
          </button>
        </div>
      ))}
    </div>
  )
}
