import { AdminShell } from '@/components/admin/admin-shell'

// 后台受保护区：侧边栏 + 顶栏 + 守卫。登录页不在此组内，故无外壳。
export default function AdminShellLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
