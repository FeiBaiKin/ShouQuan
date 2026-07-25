import { Search } from 'lucide-react'

/**
 * 关键词跑马灯：无缝滚动的关键词 chips。
 * 内容重复两份实现无缝循环；hover 暂停；reduced-motion 停止（见 globals.css）。
 */
export function KeywordMarquee({
  words,
  reverse,
  duration = 42,
}: {
  words: string[]
  reverse?: boolean
  duration?: number
}) {
  return (
    <div className="fx-marquee py-1.5" role="presentation">
      <div
        className={`fx-marquee-track ${reverse ? 'is-reverse' : ''}`}
        style={{ '--fx-marquee-dur': `${duration}s` } as React.CSSProperties}
      >
        {[1, 2].map((copy) =>
          words.map((w) => (
            <span
              key={`${copy}-${w}`}
              className="fx-chip whitespace-nowrap !text-[13px] !font-medium"
              aria-hidden={copy === 2 || undefined}
            >
              <Search size={13} className="text-[color:var(--fx-accent)]" />
              {w}
            </span>
          )),
        )}
      </div>
    </div>
  )
}
