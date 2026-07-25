'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'

/** FAQ 手风琴：grid-rows 高度过渡 + 加号旋转成关闭。 */
export function FaqAccordion({ faqs }: { faqs: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="space-y-3">
      {faqs.map((f, i) => (
        <div
          key={i}
          data-reveal
          className={`fx-glass overflow-hidden !rounded-2xl transition-colors duration-300 ${
            open === i ? 'border-[color:var(--fx-card-line-hi)]' : ''
          }`}
        >
          <button
            className="flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left"
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span
              className={`text-[14.5px] font-semibold transition-colors duration-200 ${
                open === i ? 'text-[color:var(--fx-accent)]' : 'text-[color:var(--sf-ink)]'
              }`}
            >
              {f.q}
            </span>
            <span
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--fx-card-line)] transition-transform duration-300 ${
                open === i
                  ? 'rotate-45 border-[color:var(--fx-card-line-hi)] text-[color:var(--fx-accent)]'
                  : 'text-[color:var(--sf-muted)]'
              }`}
            >
              <Plus size={15} />
            </span>
          </button>
          <div className={`fx-fold ${open === i ? 'is-open' : ''}`}>
            <div>
              <p className="px-6 pb-5 text-[13.5px] leading-relaxed text-[color:var(--sf-muted)]">
                {f.a}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
