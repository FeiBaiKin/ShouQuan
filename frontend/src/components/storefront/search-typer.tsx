'use client'

import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { prefersReducedMotion } from '@/lib/motion'

/**
 * 搜索打字演示：模拟前台搜索框，关键词自动输入 → 停顿 → 删除 → 换词。
 */
export function SearchTyper({ keywords }: { keywords: string[] }) {
  const [text, setText] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!keywords.length) return
    if (prefersReducedMotion()) {
      setText(keywords[0])
      setDone(true)
      return
    }

    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false
    const schedule = (fn: () => void, ms: number) => {
      timer = setTimeout(() => {
        if (!cancelled) fn()
      }, ms)
    }

    const typeWord = (idx: number) => {
      const word = keywords[idx % keywords.length] ?? ''
      let i = 0
      setDone(false)
      const step = () => {
        if (i <= word.length) {
          setText(word.slice(0, i))
          i++
          schedule(step, 85)
        } else {
          setDone(true)
          schedule(() => eraseWord(idx), 1700)
        }
      }
      step()
    }

    const eraseWord = (idx: number) => {
      setDone(false)
      const step = () => {
        setText((prev) => {
          if (prev.length > 0) {
            schedule(step, 32)
            return prev.slice(0, -1)
          }
          schedule(() => typeWord(idx + 1), 350)
          return prev
        })
      }
      step()
    }

    typeWord(0)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [keywords])

  return (
    <div
      className="fx-glass flex items-center gap-3 !rounded-full py-3 pl-5 pr-3 shadow-[var(--fx-glow-sm)]"
      role="img"
      aria-label="关键词搜索演示"
    >
      <Search size={18} className="shrink-0 text-[color:var(--fx-accent)]" />
      <span className="min-w-0 flex-1 truncate text-left text-[14px] text-[color:var(--sf-ink)]">
        {text}
        <span className="fx-caret" aria-hidden="true" />
      </span>
      <span
        className={`fx-mono shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-300 ${
          done ? 'text-[color:var(--fx-accent-ink)]' : 'text-[color:var(--sf-muted)]'
        }`}
        style={
          done
            ? { background: 'var(--fx-accent)' }
            : { background: 'var(--fx-card)', border: '1px solid var(--fx-card-line)' }
        }
      >
        {done ? '已回复 ✓' : '搜索'}
      </span>
    </div>
  )
}
