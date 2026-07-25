/**
 * 浏览器窗框：红绿灯 + 地址栏 + 截图。用于 hero 主视觉与 showcase 区块。
 */
export function BrowserFrame({
  src,
  alt,
  url,
  aspect = '16/10',
  eager,
}: {
  src: string
  alt: string
  url?: string
  aspect?: string
  eager?: boolean
}) {
  return (
    <figure className="fx-panel overflow-hidden !rounded-2xl shadow-[var(--fx-shadow-float)]">
      <figcaption className="flex items-center gap-2 border-b border-[color:var(--fx-card-line)] bg-[color:var(--fx-card)] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        {url && (
          <span className="fx-mono ml-3 flex min-w-0 items-center gap-1.5 rounded-md border border-[color:var(--fx-card-line)] px-2.5 py-0.5 text-[10px] text-[color:var(--sf-muted)]">
            <svg
              viewBox="0 0 24 24"
              className="h-3 w-3 shrink-0 text-[color:var(--fx-accent)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <span className="truncate">{url}</span>
          </span>
        )}
      </figcaption>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="block w-full object-cover object-top"
        style={{ aspectRatio: aspect }}
        loading={eager ? 'eager' : 'lazy'}
      />
    </figure>
  )
}
