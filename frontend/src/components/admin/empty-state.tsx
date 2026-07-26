import type { ComponentType, ReactNode } from 'react'

/** 后台统一空状态：图标 + 标题 +（可选）说明与操作。 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string }>
  title: string
  hint?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 py-14 text-center ${className ?? ''}`}
    >
      {Icon && (
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </div>
      )}
      <div className="text-sm font-medium">{title}</div>
      {hint && <div className="text-[13px] text-muted-foreground">{hint}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
