'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard,
  Box,
  Ticket,
  KeyRound,
  Receipt,
  Package,
  CreditCard,
  Settings,
  Moon,
  Sun,
  User,
  ExternalLink,
  ShieldCheck,
  LogOut,
  KeySquare,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const MENU = [
  { href: '/admin', label: '仪表盘', icon: LayoutDashboard },
  { href: '/admin/products', label: '产品管理', icon: Box },
  { href: '/admin/plans', label: '套餐管理', icon: Ticket },
  { href: '/admin/licenses', label: '授权管理', icon: KeyRound },
  { href: '/admin/orders', label: '订单管理', icon: Receipt },
  { href: '/admin/releases', label: '版本管理', icon: Package },
  { href: '/admin/payment', label: '支付与邮件', icon: CreditCard },
  { href: '/admin/settings', label: '系统设置', icon: Settings },
]

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { token, mustChangePassword, username, logout } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  // 路由守卫（对应旧 router.beforeEach）
  useEffect(() => {
    if (!mounted) return
    if (!token) {
      router.replace('/admin/login')
      return
    }
    if (mustChangePassword && pathname !== '/admin/change-password') {
      router.replace('/admin/change-password')
    }
  }, [mounted, token, mustChangePassword, pathname, router])

  // 未挂载 / 未登录 / 强制改密时不渲染后台内容（重定向中）
  if (!mounted || !token || (mustChangePassword && pathname !== '/admin/change-password')) {
    return null
  }

  const isDark = resolvedTheme === 'dark'
  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* 侧边栏 */}
      <aside className="hidden md:flex w-[220px] shrink-0 flex-col border-r bg-card">
        <div className="flex h-14 items-center gap-2.5 px-5 font-semibold">
          <ShieldCheck size={20} className="text-emerald-500" />
          <span className="truncate">授权升级中心</span>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {MENU.map((m) => {
            const Icon = m.icon
            const active = isActive(m.href)
            return (
              <Link
                key={m.href}
                href={m.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-emerald-500/12 font-medium text-emerald-600 dark:text-emerald-400'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon size={18} />
                {m.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* 主区 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-5">
          <a
            href="/"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ExternalLink size={15} />
            前台
          </a>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none">
                <User size={16} />
                {username}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push('/admin/change-password')}>
                  <KeySquare size={15} />
                  修改密码
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    logout()
                    router.push('/admin/login')
                  }}
                >
                  <LogOut size={15} />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
