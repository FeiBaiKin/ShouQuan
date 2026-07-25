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
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 text-foreground">
      <div className="w-[380px] max-w-full rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-6 text-center">
          <ShieldCheck size={34} className="mx-auto text-emerald-500" />
          <h1 className="mt-2.5 text-xl font-semibold">授权升级中心</h1>
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
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '登录中...' : '登 录'}
          </Button>
        </form>
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
