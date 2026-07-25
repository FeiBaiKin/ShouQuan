'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * 页面级 GSAP 动效。传入根容器 ref 与构建函数：
 * - 挂载后等一帧，在 scope 内 gsap.context(build) 构建动画
 * - reduced-motion 时不构建（CSS 已把 [data-reveal] 还原为可见）
 * - 卸载时自动 revert 全部动画与 ScrollTrigger
 * deps 变化时重建（用于内容异步加载完成后重新扫描 [data-reveal]）。
 */
export function usePageMotion(
  scope: React.RefObject<HTMLElement | null>,
  build: (root: HTMLElement) => void,
  deps: React.DependencyList = [],
) {
  const buildRef = useRef(build)
  buildRef.current = build

  useEffect(() => {
    const root = scope.current
    if (!root || prefersReducedMotion()) return
    let ctx: gsap.Context | null = null
    const raf = requestAnimationFrame(() => {
      ctx = gsap.context(() => buildRef.current(root), root)
      ScrollTrigger.refresh()
    })
    return () => {
      cancelAnimationFrame(raf)
      ctx?.revert()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/** scope 内所有 [data-reveal] 挂上进入视口渐入（含 blur / scale 变体） */
export function buildReveals(scope: HTMLElement | null) {
  const root = scope ?? document
  root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    const variant = el.dataset.reveal
    gsap.to(el, {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: variant === 'blur' ? 'blur(0px)' : 'none',
      duration: variant === 'blur' ? 0.9 : 0.7,
      ease: 'expo.out',
      delay: Number(el.dataset.revealDelay ?? 0),
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      onComplete: () => {
        el.style.willChange = 'auto'
      },
    })
  })
}

/** [data-hero] 元素首屏一次性入场（不依赖滚动） */
export function buildHero(scope: HTMLElement | null) {
  const root = scope ?? document
  const els = root.querySelectorAll<HTMLElement>('[data-hero]')
  if (!els.length) return
  gsap.to(els, {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    duration: 0.9,
    ease: 'expo.out',
    stagger: 0.08,
  })
}

/** 网格 stagger：容器进入视口时子项波浪式浮现 */
export function buildGridStagger(scope: HTMLElement | null, selector: string, itemSelector: string) {
  const root = scope ?? document
  root.querySelectorAll<HTMLElement>(selector).forEach((grid) => {
    const items = grid.querySelectorAll<HTMLElement>(itemSelector)
    if (!items.length) return
    gsap.to(items, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.55,
      ease: 'back.out(1.4)',
      stagger: { each: 0.07, from: 'start' },
      scrollTrigger: { trigger: grid, start: 'top 85%', once: true },
    })
  })
}
