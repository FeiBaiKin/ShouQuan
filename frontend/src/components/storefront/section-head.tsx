/** 区块标题：mono kicker + 大标题 + 副标题，自带 reveal 标记。 */
export function SectionHead({
  kicker,
  title,
  sub,
  center,
}: {
  kicker?: string
  title: string
  sub?: string
  center?: boolean
}) {
  return (
    <div className={`${center ? 'text-center' : ''} mb-10 md:mb-14`}>
      {kicker && (
        <p data-reveal className="fx-kicker">
          {kicker}
        </p>
      )}
      <h2
        data-reveal
        data-reveal-delay="0.06"
        className="fx-display mt-3 text-[1.75rem] md:text-[2.4rem] font-bold leading-[1.12] tracking-tight text-[color:var(--sf-ink)]"
      >
        {title}
      </h2>
      {sub && (
        <p
          data-reveal
          data-reveal-delay="0.12"
          className={`mt-3 text-[14px] md:text-[15px] leading-relaxed text-[color:var(--sf-muted)] ${center ? 'mx-auto max-w-[52ch]' : 'max-w-[52ch]'}`}
        >
          {sub}
        </p>
      )}
    </div>
  )
}
