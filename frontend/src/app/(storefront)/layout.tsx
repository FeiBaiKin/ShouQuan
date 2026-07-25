import { Suspense } from 'react'
import { StorefrontShell } from '@/components/storefront/storefront-shell'

// 前台路由组：套上顶部导航 + footer 外壳；useSearchParams 需 Suspense 边界。
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <StorefrontShell>{children}</StorefrontShell>
    </Suspense>
  )
}
