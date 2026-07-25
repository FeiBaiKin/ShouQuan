'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Sun, Moon, ExternalLink, Menu, X } from 'lucide-react'
import { storefrontApi } from '@/lib/api'
import type { StorefrontProduct } from '@/lib/types'
import { getProductContent } from '@/content/products'

/**
 * 前台外壳：顶部导航（含产品列表/主题切换/移动菜单）+ footer。
 * 对应旧站 StorefrontLayout.vue。产品列表客户端拉取，失败不阻塞。
 */
export function StorefrontShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeSlug = searchParams.get('slug')

  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = mounted ? resolvedTheme === 'dark' : true

  const [products, setProducts] = useState<StorefrontProduct[]>([])
  useEffect(() => {
    storefrontApi
      .products()
      .then(({ data }) => setProducts(data))
      .catch(() => {
        /* 导航失败不阻塞页面 */
      })
  }, [])

  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname, activeSlug])

  const demoUrl =
    products.length === 1 && products[0]?.slug
      ? (getProductContent(products[0].slug)?.demoUrl ?? null)
      : null

  const isHome = pathname === '/'
  const isProductActive = (slug: string) => pathname === '/product' && activeSlug === slug

  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark')

  return (
    <div className="sf-shell flex flex-col">
      <header className="sticky top-0 z-40 border-b sf-line bg-[color:var(--sf-bg)]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-[color:var(--sf-bg)]/70">
        <div className="mx-auto max-w-[1120px] px-5 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[color:var(--sf-mint)] text-white text-[11px] font-bold shadow-[var(--sf-mint-glow)]">
              授
            </span>
            <span className="sf-display text-[15px] font-bold tracking-tight">授权中心</span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5 text-[13px]">
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-md transition-colors ${
                isHome
                  ? 'text-[color:var(--sf-mint)]'
                  : 'sf-muted hover:text-[color:var(--sf-ink)]'
              }`}
            >
              目录
            </Link>
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/product?slug=${p.slug}`}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  isProductActive(p.slug)
                    ? 'text-[color:var(--sf-mint)]'
                    : 'sf-muted hover:text-[color:var(--sf-ink)]'
                }`}
              >
                {p.name}
              </Link>
            ))}
            {demoUrl && (
              <a
                href={demoUrl}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md sf-muted hover:text-[color:var(--sf-ink)] transition-colors"
              >
                演示
                <ExternalLink size={13} />
              </a>
            )}
            <button
              onClick={toggleTheme}
              className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md sf-muted hover:text-[color:var(--sf-ink)] hover:bg-black/5 dark:hover:bg-white/5 transition"
              aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </nav>

          <div className="flex md:hidden items-center gap-1">
            <button
              onClick={toggleTheme}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md sf-muted"
              aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
            >
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md"
              aria-expanded={menuOpen}
              aria-label="打开导航菜单"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t sf-line px-5 py-3">
            <nav className="flex flex-col text-[13px]">
              <Link
                href="/"
                className={`px-3 py-2.5 rounded-md ${
                  isHome ? 'text-[color:var(--sf-mint)] bg-[color:var(--sf-mint-soft)]' : ''
                }`}
              >
                目录
              </Link>
              {products.map((p) => (
                <Link
                  key={p.id}
                  href={`/product?slug=${p.slug}`}
                  className={`px-3 py-2.5 rounded-md ${
                    isProductActive(p.slug)
                      ? 'text-[color:var(--sf-mint)] bg-[color:var(--sf-mint-soft)]'
                      : ''
                  }`}
                >
                  {p.name}
                </Link>
              ))}
              {demoUrl && (
                <a
                  href={demoUrl}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-md sf-muted"
                >
                  演示站点
                  <ExternalLink size={13} />
                </a>
              )}
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t sf-line mt-auto">
        <div className="mx-auto max-w-[1120px] px-5 py-8 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between text-[12px] sf-muted">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[color:var(--sf-mint)] text-white text-[9px] font-bold">
              授
            </span>
            <span className="sf-display font-semibold">授权中心</span>
            <span>· 付款后即时发码</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/" className="hover:text-[color:var(--sf-ink)] transition-colors">
              产品目录
            </Link>
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/product?slug=${p.slug}`}
                className="hover:text-[color:var(--sf-ink)] transition-colors"
              >
                {p.name}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
