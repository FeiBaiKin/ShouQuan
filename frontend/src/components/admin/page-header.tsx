import type { ReactNode } from 'react'

/** 后台页头：标题 + 副标题 + 右侧操作区。 */
export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: string
  sub?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="m-0 text-xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-[13px] text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

/** 后台页容器（对应旧 .page）。 */
export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1440px] px-4 pb-10 pt-5 md:px-6">{children}</div>
}
