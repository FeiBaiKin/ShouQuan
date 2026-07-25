'use client'

import type { PointerEvent } from 'react'
import type { LucideIcon } from 'lucide-react'

/** 购买步骤：编号追光卡 + 桌面端渐变连接线。 */
export function StepFlow({
  steps,
}: {
  steps: { icon: LucideIcon; title: string; desc: string }[]
}) {
  function onMove(e: PointerEvent<HTMLLIElement>) {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`)
    el.style.setProperty('--my', `${e.clientY - rect.top}px`)
  }

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute left-[12%] right-[12%] top-[52px] hidden h-px md:block"
        style={{
          background:
            'linear-gradient(90deg, transparent, var(--fx-accent) 20%, var(--fx-cyan) 80%, transparent)',
          opacity: 0.35,
        }}
        aria-hidden="true"
      />
      <ol className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
        {steps.map((st, i) => {
          const Icon = st.icon
          return (
            <li
              key={st.title}
              data-stagger
              className="fx-glass fx-spot-card relative !rounded-2xl p-7 transition-transform duration-300 hover:-translate-y-1"
              onPointerMove={onMove}
            >
              <div className="flex items-center justify-between">
                <span
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-[color:var(--fx-accent)]"
                  style={{ background: 'color-mix(in srgb, var(--fx-accent) 12%, transparent)' }}
                >
                  <Icon size={22} />
                </span>
                <span className="fx-mono text-[11px] font-semibold text-[color:var(--sf-muted)]">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <h3 className="fx-display mt-5 text-[16px] font-bold text-[color:var(--sf-ink)]">
                {st.title}
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--sf-muted)]">
                {st.desc}
              </p>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
