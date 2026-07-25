'use client'

import type { PointerEvent, ReactNode } from 'react'

/**
 * 追光玻璃卡：鼠标划过时出现跟随指针的径向光晕。hover 微抬升。
 */
export function GlowCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  function onMove(e: PointerEvent<HTMLDivElement>) {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`)
    el.style.setProperty('--my', `${e.clientY - rect.top}px`)
  }

  return (
    <div
      className={`fx-glass fx-spot-card transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-[color:var(--fx-card-line-hi)] hover:shadow-[var(--fx-glow)] ${className}`}
      onPointerMove={onMove}
    >
      {children}
    </div>
  )
}
