import { AdminAuthProvider } from '@/lib/auth'
import { Toaster } from '@/components/ui/sonner'

// 后台根布局：提供鉴权上下文 + 全局 toast。登录页与后台壳都在其下。
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      {children}
      <Toaster richColors position="top-right" />
    </AdminAuthProvider>
  )
}
