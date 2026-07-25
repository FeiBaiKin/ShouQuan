'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, Save, ShieldCheck } from 'lucide-react'
import { authApi, extractError, settingsApi } from '@/lib/api'
import { PageContainer, PageHeader } from '@/components/admin/page-header'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsPage() {
  const [heartbeat, setHeartbeat] = useState(6)
  const [grace, setGrace] = useState(7)
  const [loading, setLoading] = useState(true)
  const [settingsBusy, setSettingsBusy] = useState(false)

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwdBusy, setPwdBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await settingsApi.get()
        if (cancelled) return
        setHeartbeat(data.heartbeat_interval_hours)
        setGrace(data.grace_period_days)
      } catch (err) {
        if (!cancelled) toast.error(extractError(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function saveSettings() {
    setSettingsBusy(true)
    try {
      await settingsApi.update({
        heartbeat_interval_hours: Number(heartbeat),
        grace_period_days: Number(grace),
      })
      toast.success('已保存，客户端将在下次心跳时获取新参数')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSettingsBusy(false)
    }
  }

  async function changePassword() {
    if (!oldPassword || !newPassword) {
      toast.warning('请填写原密码和新密码')
      return
    }
    if (newPassword.length < 6) {
      toast.warning('新密码至少 6 位')
      return
    }
    if (newPassword !== confirm) {
      toast.warning('两次输入的新密码不一致')
      return
    }
    setPwdBusy(true)
    try {
      await authApi.changePassword(oldPassword, newPassword)
      toast.success('密码已修改')
      setOldPassword('')
      setNewPassword('')
      setConfirm('')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setPwdBusy(false)
    }
  }

  return (
    <PageContainer>
      <PageHeader title="系统设置" sub="授权校验参数与账号安全" />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* 授权校验参数 */}
        <Card size="sm">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-muted-foreground" />
              授权校验参数
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <>
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-9 w-24" />
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="heartbeat">心跳间隔（小时）</Label>
                  <Input
                    id="heartbeat"
                    type="number"
                    min={1}
                    max={168}
                    value={heartbeat}
                    onChange={(e) => setHeartbeat(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="grace">断网宽限期（天）</Label>
                  <Input
                    id="grace"
                    type="number"
                    min={0}
                    max={90}
                    value={grace}
                    onChange={(e) => setGrace(Number(e.target.value))}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  客户站点每隔「心跳间隔」向本中心校验一次授权；连不上服务器时，凭本地缓存凭证最多可继续运行「宽限期」天数，超过后停止对外服务。
                </p>
                <Button onClick={saveSettings} disabled={settingsBusy}>
                  <Save className="size-4" />
                  {settingsBusy ? '保存中...' : '保存设置'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* 修改密码 */}
        <Card size="sm">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-muted-foreground" />
              修改密码
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                void changePassword()
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="old-password">原密码</Label>
                <Input
                  id="old-password"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">新密码</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="至少 6 位"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">确认新密码</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={pwdBusy}>
                {pwdBusy ? '修改中...' : '修改密码'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
