/**
 * 环境光背景：极光色斑 + 点阵网格 + 噪点颗粒。
 * 绝对定位铺满父容器（父容器需 position:relative + overflow:hidden）。
 */
export function AmbientBackdrop({ noGrid }: { noGrid?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="fx-blob h-[520px] w-[720px] -top-40 left-[-10%]"
        style={{ background: 'var(--fx-aurora-a)', animationDelay: '0s' }}
      />
      <div
        className="fx-blob h-[460px] w-[620px] -top-24 right-[-12%]"
        style={{ background: 'var(--fx-aurora-b)', animationDelay: '-9s', animationDuration: '31s' }}
      />
      <div
        className="fx-blob h-[420px] w-[520px] top-[30%] left-[32%]"
        style={{ background: 'var(--fx-aurora-c)', animationDelay: '-17s', animationDuration: '37s' }}
      />
      {!noGrid && <div className="fx-dotgrid absolute inset-0" />}
      <div className="fx-noise absolute inset-0" />
    </div>
  )
}
