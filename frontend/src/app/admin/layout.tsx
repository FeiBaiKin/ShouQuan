import { AdminAuthProvider } from '@/lib/auth'
import { Toaster } from '@/components/ui/sonner'

// 后台根布局：提供鉴权上下文 + 全局 toast。登录页与后台壳都在其下。
// data-admin-root 触发 globals.css 中 body:has 的后台设计令牌（含弹层传送门）。
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <div data-admin-root className="contents">
        {children}
      </div>
      <Toaster richColors position="top-right" />
    </AdminAuthProvider>
  )
}
