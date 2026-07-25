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
    <div className="mb-[18px] flex items-center justify-between gap-4">
      <div>
        <h1 className="m-0 text-xl font-semibold">{title}</h1>
        {sub && <p className="mt-1 text-[13px] text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

/** 后台页容器（对应旧 .page）。 */
export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1440px] px-6 pb-8 pt-5">{children}</div>
}
