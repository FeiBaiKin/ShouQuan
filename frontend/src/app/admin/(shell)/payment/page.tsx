'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { CreditCard, Globe, Mail, Save, Send } from 'lucide-react'
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

const providerOptions = [
  { label: '支付宝', value: 'alipay' },
  { label: '微信支付', value: 'wechat' },
]

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

/** 带文字的分割线（对应 NDivider 文本样式）。 */
function LabeledDivider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <Separator className="flex-1" />
      <span className="shrink-0 text-xs font-medium text-muted-foreground">{children}</span>
      <Separator className="flex-1" />
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
  const [enabledProviders, setEnabledProviders] = useState<string[]>([])
  const [testEmailTo, setTestEmailTo] = useState('')

  const updatePayment = (key: string, value: string) =>
    setPayment((prev) => ({ ...prev, [key]: value }))
  const updateEmail = (key: string, value: string) =>
    setEmail((prev) => ({ ...prev, [key]: value }))
  const updateSite = (key: string, value: string) =>
    setSite((prev) => ({ ...prev, [key]: value }))

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
      await paymentConfigApi.update({ payment: nextPayment, email, site })
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
        sub="配置支付通道、SMTP 邮件与站点信息"
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
          </TabsList>

          {/* 支付配置 */}
          <TabsContent value="payment">
            <Card>
              <CardContent className="space-y-4">
                <Field label="启用的支付方式">
                  <div className="flex flex-wrap gap-6">
                    {providerOptions.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={enabledProviders.includes(opt.value)}
                          onCheckedChange={(on) => toggleProvider(opt.value, on)}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </Field>

                <Field label="站点公网地址（用于拼接回调 URL）" className="max-w-[360px]">
                  <Input
                    value={payment.payment_site_url ?? ''}
                    onChange={(e) => updatePayment('payment_site_url', e.target.value)}
                    placeholder="https://auth.example.com"
                  />
                </Field>

                <LabeledDivider>微信支付 V3</LabeledDivider>

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
                <Field label="商户私钥（PEM）">
                  <Textarea
                    rows={5}
                    value={payment.payment_wx_private_key ?? ''}
                    onChange={(e) => updatePayment('payment_wx_private_key', e.target.value)}
                    placeholder={'-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'}
                  />
                </Field>
                <Field label="平台证书序列号">
                  <Input
                    value={payment.payment_wx_platform_serial_no ?? ''}
                    onChange={(e) => updatePayment('payment_wx_platform_serial_no', e.target.value)}
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
                <Field label="异步通知 URL（留空则自动拼接）">
                  <Input
                    value={payment.payment_wx_notify_url ?? ''}
                    onChange={(e) => updatePayment('payment_wx_notify_url', e.target.value)}
                    placeholder="https://auth.example.com/api/payment/callback/wechat"
                  />
                </Field>

                <LabeledDivider>支付宝</LabeledDivider>

                <Field label="应用 AppID">
                  <Input
                    value={payment.payment_ali_appid ?? ''}
                    onChange={(e) => updatePayment('payment_ali_appid', e.target.value)}
                  />
                </Field>
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
                <Field label="支付场景" className="max-w-[360px]">
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* 邮件配置 */}
          <TabsContent value="email">
            <Card>
              <CardContent className="space-y-4">
                <Field label="SMTP 服务器" className="max-w-[320px]">
                  <Input
                    value={email.email_smtp_host ?? ''}
                    onChange={(e) => updateEmail('email_smtp_host', e.target.value)}
                    placeholder="smtp.example.com"
                  />
                </Field>
                <Field label="端口" className="max-w-[200px]">
                  <Input
                    value={email.email_smtp_port ?? ''}
                    onChange={(e) => updateEmail('email_smtp_port', e.target.value)}
                    placeholder="465（SSL）或 587（STARTTLS）"
                  />
                </Field>
                <Field label="用户名" className="max-w-[320px]">
                  <Input
                    value={email.email_smtp_user ?? ''}
                    onChange={(e) => updateEmail('email_smtp_user', e.target.value)}
                    placeholder="发信邮箱地址"
                  />
                </Field>
                <Field label="密码 / 授权码" className="max-w-[320px]">
                  <Input
                    type="password"
                    value={email.email_smtp_pass ?? ''}
                    onChange={(e) => updateEmail('email_smtp_pass', e.target.value)}
                  />
                </Field>
                <Field label="发件人名称" className="max-w-[240px]">
                  <Input
                    value={email.email_from_name ?? ''}
                    onChange={(e) => updateEmail('email_from_name', e.target.value)}
                    placeholder="授权中心"
                  />
                </Field>

                <Separator />

                <Field label="发送测试邮件">
                  <div className="flex items-center gap-3">
                    <Input
                      className="w-[260px]"
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
                <Field label="站点名称" className="max-w-[320px]">
                  <Input
                    value={site.site_name ?? ''}
                    onChange={(e) => updateSite('site_name', e.target.value)}
                    placeholder="授权中心"
                  />
                </Field>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </PageContainer>
  )
}
