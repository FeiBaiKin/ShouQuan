'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ChevronDown,
  Contact,
  CreditCard,
  Globe,
  ImagePlus,
  Mail,
  Save,
  Send,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { extractError, paymentConfigApi } from '@/lib/api'
import { PageContainer, PageHeader } from '@/components/admin/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const aliSceneOptions = [
  { label: '电脑网站支付 page（跳转收银台）', value: 'page' },
  { label: '当面付 precreate（扫码）', value: 'precreate' },
]

/** 带标题的字段容器（label 在上）。 */
function Field({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className ? `space-y-1.5 ${className}` : 'space-y-1.5'}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

/** 二维码上传：选图后转 base64 data URL 存入配置值，带预览与移除。 */
function QrUploadField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const pick = () => inputRef.current?.click()

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.warning('请选择图片文件')
      return
    }
    if (file.size > 500 * 1024) {
      toast.warning('图片不能超过 500KB，请压缩后再上传')
      return
    }
    const reader = new FileReader()
    reader.onload = () => onChange(String(reader.result ?? ''))
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      {value ? (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={label}
            className="h-24 w-24 rounded-md border bg-white object-contain"
          />
          <div className="flex flex-col gap-2">
            <Button type="button" variant="outline" size="sm" onClick={pick}>
              <ImagePlus />
              更换
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onChange('')}>
              <Trash2 />
              移除
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          className="flex h-24 w-24 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ImagePlus className="size-5" />
          <span className="text-xs">上传二维码</span>
        </button>
      )}
    </div>
  )
}

/** 支付渠道折叠面板：头部为渠道名 + 启用开关，配置项内嵌在面板内。 */
function ProviderPanel({
  title,
  enabled,
  onEnabledChange,
  children,
}: {
  title: string
  enabled: boolean
  onEnabledChange: (on: boolean) => void
  children: ReactNode
}) {
  const [open, setOpen] = useState(enabled)
  return (
    <div className="rounded-lg border">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen((v) => !v)
          }
        }}
        className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform duration-200 ${
              open ? '' : '-rotate-90'
            }`}
          />
          <span className={`text-sm font-medium ${enabled ? '' : 'text-muted-foreground'}`}>
            {title}
          </span>
        </div>
        {/* 开关独立于头部点击（阻止冒泡，避免切换开关时折叠面板） */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <span className="text-xs text-muted-foreground">{enabled ? '已启用' : '未启用'}</span>
          <Switch
            checked={enabled}
            onCheckedChange={(on) => {
              onEnabledChange(on)
              if (on) setOpen(true)
            }}
          />
        </div>
      </div>
      <div className={`fx-fold ${open ? 'is-open' : ''}`}>
        <div>
          <div className="space-y-4 border-t px-4 py-4">{children}</div>
        </div>
      </div>
    </div>
  )
}

export default function PaymentConfigPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const [payment, setPayment] = useState<Record<string, string>>({})
  const [email, setEmail] = useState<Record<string, string>>({})
  const [site, setSite] = useState<Record<string, string>>({})
  const [contact, setContact] = useState<Record<string, string>>({})
  const [enabledProviders, setEnabledProviders] = useState<string[]>([])
  const [testEmailTo, setTestEmailTo] = useState('')

  const updatePayment = (key: string, value: string) =>
    setPayment((prev) => ({ ...prev, [key]: value }))
  const updateEmail = (key: string, value: string) =>
    setEmail((prev) => ({ ...prev, [key]: value }))
  const updateSite = (key: string, value: string) =>
    setSite((prev) => ({ ...prev, [key]: value }))
  const updateContact = (key: string, value: string) =>
    setContact((prev) => ({ ...prev, [key]: value }))

  function toggleProvider(value: string, on: boolean) {
    setEnabledProviders((prev) =>
      on ? [...new Set([...prev, value])] : prev.filter((v) => v !== value),
    )
  }

  async function load() {
    setLoading(true)
    try {
      const { data } = await paymentConfigApi.get()
      setPayment({ ...data.payment })
      setEmail({ ...data.email })
      setSite({ ...data.site })
      setContact({ ...data.contact })
      // 解析已启用支付方式
      try {
        setEnabledProviders(
          data.payment.payment_enabled_providers
            ? JSON.parse(data.payment.payment_enabled_providers)
            : [],
        )
      } catch {
        setEnabledProviders([])
      }
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save() {
    // 同步 enabled_providers 回字符串
    const nextPayment = {
      ...payment,
      payment_enabled_providers: JSON.stringify(enabledProviders),
    }
    setPayment(nextPayment)
    setSaving(true)
    try {
      await paymentConfigApi.update({ payment: nextPayment, email, site, contact })
      toast.success('配置已保存')
      await load()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  async function testEmail() {
    if (!testEmailTo) {
      toast.warning('请填写收件邮箱')
      return
    }
    setTesting(true)
    try {
      await paymentConfigApi.testEmail(testEmailTo)
      toast.success('测试邮件已发送，请查收')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setTesting(false)
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="支付与邮件配置"
        sub="配置支付通道、SMTP 邮件、站点信息与联系方式"
        actions={
          <Button onClick={save} disabled={saving}>
            <Save />
            {saving ? '保存中...' : '保存配置'}
          </Button>
        }
      />

      {loading ? (
        <Skeleton className="h-[420px] rounded-xl" />
      ) : (
        <Tabs defaultValue="payment">
          <TabsList variant="line">
            <TabsTrigger value="payment">
              <CreditCard />
              支付配置
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail />
              邮件配置
            </TabsTrigger>
            <TabsTrigger value="site">
              <Globe />
              站点配置
            </TabsTrigger>
            <TabsTrigger value="contact">
              <Contact />
              联系方式
            </TabsTrigger>
          </TabsList>

          {/* 支付配置 */}
          <TabsContent value="payment">
            <Card>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="站点公网地址（用于拼接回调 URL）">
                    <Input
                      value={payment.payment_site_url ?? ''}
                      onChange={(e) => updatePayment('payment_site_url', e.target.value)}
                      placeholder="https://auth.example.com"
                    />
                  </Field>
                </div>

                <ProviderPanel
                  title="微信支付 V3"
                  enabled={enabledProviders.includes('wechat')}
                  onEnabledChange={(on) => toggleProvider('wechat', on)}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="AppID">
                      <Input
                        value={payment.payment_wx_appid ?? ''}
                        onChange={(e) => updatePayment('payment_wx_appid', e.target.value)}
                        placeholder="wx 开头的应用 ID"
                      />
                    </Field>
                    <Field label="商户号 MchID">
                      <Input
                        value={payment.payment_wx_mchid ?? ''}
                        onChange={(e) => updatePayment('payment_wx_mchid', e.target.value)}
                      />
                    </Field>
                    <Field label="证书序列号">
                      <Input
                        value={payment.payment_wx_serial_no ?? ''}
                        onChange={(e) => updatePayment('payment_wx_serial_no', e.target.value)}
                      />
                    </Field>
                    <Field label="APIv3 密钥（32 字节）">
                      <Input
                        type="password"
                        value={payment.payment_wx_api_v3_key ?? ''}
                        onChange={(e) => updatePayment('payment_wx_api_v3_key', e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Field label="商户私钥（PEM）">
                      <Textarea
                        rows={5}
                        value={payment.payment_wx_private_key ?? ''}
                        onChange={(e) => updatePayment('payment_wx_private_key', e.target.value)}
                        placeholder={'-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'}
                      />
                    </Field>
                    <Field label="平台公钥或平台证书（PEM）">
                      <Textarea
                        rows={5}
                        value={payment.payment_wx_platform_public_key ?? ''}
                        onChange={(e) =>
                          updatePayment('payment_wx_platform_public_key', e.target.value)
                        }
                        placeholder={'-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----'}
                      />
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="平台证书序列号">
                      <Input
                        value={payment.payment_wx_platform_serial_no ?? ''}
                        onChange={(e) =>
                          updatePayment('payment_wx_platform_serial_no', e.target.value)
                        }
                      />
                    </Field>
                    <Field label="异步通知 URL（留空则自动拼接）">
                      <Input
                        value={payment.payment_wx_notify_url ?? ''}
                        onChange={(e) => updatePayment('payment_wx_notify_url', e.target.value)}
                        placeholder="https://auth.example.com/api/payment/callback/wechat"
                      />
                    </Field>
                  </div>
                </ProviderPanel>

                <ProviderPanel
                  title="支付宝"
                  enabled={enabledProviders.includes('alipay')}
                  onEnabledChange={(on) => toggleProvider('alipay', on)}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="应用 AppID">
                      <Input
                        value={payment.payment_ali_appid ?? ''}
                        onChange={(e) => updatePayment('payment_ali_appid', e.target.value)}
                      />
                    </Field>
                    <Field label="支付场景">
                      <Select
                        value={payment.payment_ali_scene || undefined}
                        onValueChange={(v) => updatePayment('payment_ali_scene', v)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="选择支付场景" />
                        </SelectTrigger>
                        <SelectContent>
                          {aliSceneOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Field label="应用私钥（PEM）">
                      <Textarea
                        rows={5}
                        value={payment.payment_ali_private_key ?? ''}
                        onChange={(e) => updatePayment('payment_ali_private_key', e.target.value)}
                        placeholder={
                          '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'
                        }
                      />
                    </Field>
                    <Field label="支付宝公钥（PEM）">
                      <Textarea
                        rows={5}
                        value={payment.payment_ali_public_key ?? ''}
                        onChange={(e) => updatePayment('payment_ali_public_key', e.target.value)}
                        placeholder={'-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----'}
                      />
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="异步通知 URL（留空则自动拼接）">
                      <Input
                        value={payment.payment_ali_notify_url ?? ''}
                        onChange={(e) => updatePayment('payment_ali_notify_url', e.target.value)}
                      />
                    </Field>
                    <Field label="同步返回 URL（留空则自动拼接）">
                      <Input
                        value={payment.payment_ali_return_url ?? ''}
                        onChange={(e) => updatePayment('payment_ali_return_url', e.target.value)}
                      />
                    </Field>
                  </div>
                </ProviderPanel>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 邮件配置 */}
          <TabsContent value="email">
            <Card>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="SMTP 服务器">
                    <Input
                      value={email.email_smtp_host ?? ''}
                      onChange={(e) => updateEmail('email_smtp_host', e.target.value)}
                      placeholder="smtp.example.com"
                    />
                  </Field>
                  <Field label="端口">
                    <Input
                      value={email.email_smtp_port ?? ''}
                      onChange={(e) => updateEmail('email_smtp_port', e.target.value)}
                      placeholder="465（SSL）或 587（STARTTLS）"
                    />
                  </Field>
                  <Field label="用户名">
                    <Input
                      value={email.email_smtp_user ?? ''}
                      onChange={(e) => updateEmail('email_smtp_user', e.target.value)}
                      placeholder="发信邮箱地址"
                    />
                  </Field>
                  <Field label="密码 / 授权码">
                    <Input
                      type="password"
                      value={email.email_smtp_pass ?? ''}
                      onChange={(e) => updateEmail('email_smtp_pass', e.target.value)}
                    />
                  </Field>
                  <Field label="发件人名称">
                    <Input
                      value={email.email_from_name ?? ''}
                      onChange={(e) => updateEmail('email_from_name', e.target.value)}
                      placeholder="授权中心"
                    />
                  </Field>
                </div>

                <Separator />

                <Field label="发送测试邮件">
                  <div className="flex flex-wrap items-center gap-3">
                    <Input
                      className="w-full sm:w-[280px]"
                      value={testEmailTo}
                      onChange={(e) => setTestEmailTo(e.target.value)}
                      placeholder="收件邮箱"
                    />
                    <Button variant="outline" onClick={testEmail} disabled={testing}>
                      <Send />
                      {testing ? '发送中...' : '发送测试'}
                    </Button>
                  </div>
                </Field>
                <p className="m-0 text-xs text-muted-foreground">
                  提示：测试邮件使用当前已保存的配置，请先点击顶部「保存配置」。
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 站点配置 */}
          <TabsContent value="site">
            <Card>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="站点名称">
                    <Input
                      value={site.site_name ?? ''}
                      onChange={(e) => updateSite('site_name', e.target.value)}
                      placeholder="授权中心"
                    />
                  </Field>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 联系方式 */}
          <TabsContent value="contact">
            <Card>
              <CardContent className="space-y-5">
                <p className="m-0 text-xs text-muted-foreground">
                  展示在前台页脚。留空的项前台不显示；上传了二维码的项，前台点击后弹出二维码。
                </p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-4 rounded-lg border p-4">
                    <Field label="QQ 号">
                      <Input
                        value={contact.contact_qq ?? ''}
                        onChange={(e) => updateContact('contact_qq', e.target.value)}
                        placeholder="如 12345678"
                      />
                    </Field>
                    <QrUploadField
                      label="QQ 二维码（可选）"
                      value={contact.contact_qq_qr ?? ''}
                      onChange={(v) => updateContact('contact_qq_qr', v)}
                    />
                  </div>
                  <div className="space-y-4 rounded-lg border p-4">
                    <Field label="QQ 群号">
                      <Input
                        value={contact.contact_qq_group ?? ''}
                        onChange={(e) => updateContact('contact_qq_group', e.target.value)}
                        placeholder="如 87654321"
                      />
                    </Field>
                    <QrUploadField
                      label="QQ 群二维码（可选）"
                      value={contact.contact_qq_group_qr ?? ''}
                      onChange={(v) => updateContact('contact_qq_group_qr', v)}
                    />
                  </div>
                  <div className="space-y-4 rounded-lg border p-4">
                    <Field label="微信号">
                      <Input
                        value={contact.contact_wechat ?? ''}
                        onChange={(e) => updateContact('contact_wechat', e.target.value)}
                        placeholder="微信号或备注文字"
                      />
                    </Field>
                    <QrUploadField
                      label="微信二维码（可选）"
                      value={contact.contact_wechat_qr ?? ''}
                      onChange={(v) => updateContact('contact_wechat_qr', v)}
                    />
                  </div>
                  <div className="space-y-4 rounded-lg border p-4">
                    <Field label="邮箱">
                      <Input
                        value={contact.contact_email ?? ''}
                        onChange={(e) => updateContact('contact_email', e.target.value)}
                        placeholder="support@example.com"
                      />
                    </Field>
                    <p className="m-0 text-xs text-muted-foreground">
                      前台点击后调起邮件客户端，无需二维码。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </PageContainer>
  )
}
