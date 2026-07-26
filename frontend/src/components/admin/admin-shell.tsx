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
  ExternalLink,
  ShieldCheck,
  LogOut,
  KeySquare,
  Menu,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const MENU_GROUPS = [
  {
    label: null,
    items: [{ href: '/admin', label: '仪表盘', icon: LayoutDashboard }],
  },
  {
    label: '业务',
    items: [
      { href: '/admin/products', label: '产品管理', icon: Box },
      { href: '/admin/plans', label: '套餐管理', icon: Ticket },
      { href: '/admin/licenses', label: '授权管理', icon: KeyRound },
      { href: '/admin/releases', label: '版本管理', icon: Package },
    ],
  },
  {
    label: '交易',
    items: [{ href: '/admin/orders', label: '订单管理', icon: Receipt }],
  },
  {
    label: '配置',
    items: [
      { href: '/admin/payment', label: '支付与邮件', icon: CreditCard },
      { href: '/admin/settings', label: '系统设置', icon: Settings },
    ],
  },
]

const MENU_FLAT = MENU_GROUPS.flatMap((g) => g.items)

function isActive(pathname: string, href: string) {
  return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
}

function currentLabel(pathname: string) {
  if (pathname.startsWith('/admin/change-password')) return '修改密码'
  return MENU_FLAT.find((m) => isActive(pathname, m.href))?.label ?? ''
}

/** 侧边栏内容：品牌区 + 分组导航（桌面常驻 / 移动端抽屉共用）。 */
function SidebarContent({
  pathname,
  onNavigate,
}: {
  pathname: string
  onNavigate?: () => void
}) {
  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b px-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck size={17} />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13.5px] font-semibold">授权升级中心</div>
          <div className="mono text-[10px] tracking-[0.14em] text-muted-foreground">
            ADMIN CONSOLE
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {MENU_GROUPS.map((group, gi) => (
          <div key={group.label ?? gi}>
            {group.label && (
              <div className="px-3 pb-1 pt-4 text-[11px] font-medium tracking-wider text-muted-foreground/70">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((m) => {
                const Icon = m.icon
                const active = isActive(pathname, m.href)
                return (
                  <Link
                    key={m.href}
                    href={m.href}
                    onClick={onNavigate}
                    className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
                    )}
                    <Icon size={16} strokeWidth={active ? 2 : 1.75} />
                    {m.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </>
  )
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { token, mustChangePassword, username, logout } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

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
  const label = currentLabel(pathname)

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* 桌面侧边栏 */}
      <aside className="hidden w-[232px] shrink-0 flex-col border-r bg-card md:flex">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* 移动端抽屉 */}
      {navOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 animate-in fade-in duration-200"
            onClick={() => setNavOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[248px] flex-col border-r bg-card shadow-xl animate-in fade-in slide-in-from-left-8 duration-200">
            <SidebarContent pathname={pathname} onNavigate={() => setNavOpen(false)} />
          </aside>
        </div>
      )}

      {/* 主区 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background/85 px-4 backdrop-blur md:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setNavOpen(true)}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
              aria-label="打开导航菜单"
            >
              <Menu size={18} />
            </button>
            {/* 移动端：当前页名；桌面：面包屑 */}
            <div className="truncate text-sm font-medium md:hidden">{label}</div>
            <div className="hidden items-center gap-1.5 text-[13px] text-muted-foreground md:flex">
              <span>管理后台</span>
              <ChevronRight size={13} className="opacity-50" />
              <span className="font-medium text-foreground">{label}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <a
              href="/"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ExternalLink size={14} />
              <span className="hidden sm:inline">前台站点</span>
            </a>
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md py-1.5 pl-1.5 pr-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
                  {(username || 'A').slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden sm:inline">{username}</span>
                <ChevronDown size={13} className="opacity-60" />
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
