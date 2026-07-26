'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { extractError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function LoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { token, mustChangePassword, login } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  // 已登录访问登录页 → 跳转
  useEffect(() => {
    if (!mounted || !token) return
    router.replace(mustChangePassword ? '/admin/change-password' : '/admin')
  }, [mounted, token, mustChangePassword, router])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!username || !password) {
      toast.warning('请输入用户名和密码')
      return
    }
    setLoading(true)
    try {
      await login(username, password)
      // login 成功后 mustChangePassword 已更新，读取最新值
      const must = localStorage.getItem('must_change_password') === 'true'
      if (must) {
        router.replace('/admin/change-password')
        return
      }
      router.replace(searchParams.get('redirect') || '/admin')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-6 text-foreground">
      {/* 点阵背景（复用前台 fx-dotgrid） */}
      <div aria-hidden className="fx-dotgrid pointer-events-none absolute inset-0" />

      <div className="relative w-[400px] max-w-full rounded-2xl border bg-card p-8 shadow-lg shadow-black/[0.04] dark:shadow-black/20">
        <div className="mb-7 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
            <ShieldCheck size={26} />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">授权升级中心</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">程序授权与在线更新管理</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="mt-1 w-full" size="lg" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </Button>
        </form>
        <div className="mono mt-7 text-center text-[10px] tracking-[0.18em] text-muted-foreground/70">
          ADMIN CONSOLE
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  )
}
