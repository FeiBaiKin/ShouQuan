'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { authApi, extractError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { PageContainer, PageHeader } from '@/components/admin/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ChangePasswordPage() {
  const router = useRouter()
  const { mustChangePassword, markPasswordChanged } = useAuth()

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!oldPassword || !newPassword) {
      toast.warning('请填写原密码和新密码')
      return
    }
    if (newPassword.length < 6) {
      toast.warning('新密码至少 6 位')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.warning('两次输入的新密码不一致')
      return
    }
    setSaving(true)
    try {
      await authApi.changePassword(oldPassword, newPassword)
      markPasswordChanged()
      toast.success('密码已修改')
      router.push('/admin')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageContainer>
      <PageHeader title="修改密码" sub="首次登录必须设置新的管理员密码" />
      <div className="max-w-[520px] rounded-xl border bg-card p-6">
        {mustChangePassword && (
          <div className="mb-[18px] rounded-md bg-amber-500/12 px-4 py-3 text-[13px] text-amber-700 dark:text-amber-400">
            当前账号仍在使用初始密码，修改后才能进入其他后台页面。
          </div>
        )}
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="old">原密码</Label>
            <Input
              id="old"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new">新密码</Label>
            <Input
              id="new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">确认新密码</Label>
            <Input
              id="confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? '保存中...' : '保存新密码'}
          </Button>
        </form>
      </div>
    </PageContainer>
  )
}
