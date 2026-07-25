'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { extractError, licenseApi, productApi, type LicenseQuery } from '@/lib/api'
import type { HeartbeatLog, License, LicenseEvent, LicenseStatus, Product } from '@/lib/types'
import { durationLabels, eventLabels, formatTime, statusBadgeClass, statusLabels } from '@/lib/format'
import { PageContainer, PageHeader } from '@/components/admin/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const ALL = '__all__'
const STATUS_OPTIONS = [
  { label: '有效', value: 'active' },
  { label: '未激活', value: 'unactivated' },
  { label: '已过期', value: 'expired' },
  { label: '30 天内到期', value: 'expiring' },
  { label: '已吊销', value: 'revoked' },
]

/** 简易分段控件（替代 naive-ui NRadioGroup/NRadioButton） */
function Segmented({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { label: string; value: string }[]
}) {
  return (
    <div className="inline-flex rounded-md border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded px-3 py-1.5 text-sm transition-colors ${
            value === o.value
              ? 'bg-emerald-500/15 font-medium text-emerald-600 dark:text-emerald-400'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function LicensesPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [items, setItems] = useState<License[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [query, setQuery] = useState<LicenseQuery>({
    product_id: null,
    status: null,
    q: '',
    page: 1,
    page_size: 20,
  })
  const [qInput, setQInput] = useState('')

  const load = useCallback(async (q: LicenseQuery) => {
    setLoading(true)
    try {
      const { data } = await licenseApi.list(q)
      setItems(data.items)
      setTotal(data.total)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    productApi
      .list()
      .then(({ data }) => setProducts(data))
      .catch((e) => toast.error(extractError(e)))
  }, [])

  useEffect(() => {
    load(query)
  }, [query, load])

  const patchQuery = (patch: Partial<LicenseQuery>, resetPage = true) =>
    setQuery((q) => ({ ...q, ...patch, ...(resetPage ? { page: 1 } : {}) }))

  const totalPages = Math.max(1, Math.ceil(total / query.page_size))

  // ---- 发放授权 ----
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createdCodes, setCreatedCodes] = useState<string[]>([])
  const [createForm, setCreateForm] = useState({
    product_id: null as number | null,
    customer_name: '',
    customer_contact: '',
    remark: '',
    duration_type: 'yearly',
    duration_days: 365,
    count: 1,
  })

  function openCreate() {
    setCreatedCodes([])
    setCreateForm({
      product_id: null,
      customer_name: '',
      customer_contact: '',
      remark: '',
      duration_type: 'yearly',
      duration_days: 365,
      count: 1,
    })
    setShowCreate(true)
  }

  async function submitCreate() {
    if (!createForm.product_id) {
      toast.warning('请选择产品')
      return
    }
    setCreating(true)
    try {
      const { data } = await licenseApi.create({
        product_id: createForm.product_id,
        customer_name: createForm.customer_name,
        customer_contact: createForm.customer_contact,
        remark: createForm.remark,
        duration_type: createForm.duration_type,
        duration_days: createForm.duration_days,
        count: createForm.count,
      })
      setCreatedCodes(data.items.map((i) => i.code))
      toast.success(`已生成 ${data.items.length} 个授权码`)
      load(query)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setCreating(false)
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(
      () => toast.success('授权码已复制'),
      () => toast.error('复制失败'),
    )
  }

  // ---- 详情 ----
  const [showDetail, setShowDetail] = useState(false)
  const [detail, setDetail] = useState<License | null>(null)
  const [detailEvents, setDetailEvents] = useState<LicenseEvent[]>([])
  const [detailHeartbeats, setDetailHeartbeats] = useState<HeartbeatLog[]>([])

  async function openDetail(l: License) {
    setDetail(null)
    setDetailEvents([])
    setDetailHeartbeats([])
    setShowDetail(true)
    try {
      const { data } = await licenseApi.detail(l.id)
      setDetail(data.license)
      setDetailEvents(data.events)
      setDetailHeartbeats(data.heartbeats)
    } catch (err) {
      toast.error(extractError(err))
    }
  }

  // ---- 操作弹窗 ----
  const [actionBusy, setActionBusy] = useState(false)

  const [showEdit, setShowEdit] = useState(false)
  const [editTarget, setEditTarget] = useState<License | null>(null)
  const [editForm, setEditForm] = useState({ customer_name: '', customer_contact: '', remark: '' })

  const [showRenew, setShowRenew] = useState(false)
  const [renewTarget, setRenewTarget] = useState<License | null>(null)
  const [renewForm, setRenewForm] = useState({ mode: 'days', days: 365 })

  const [showRebind, setShowRebind] = useState(false)
  const [rebindTarget, setRebindTarget] = useState<License | null>(null)
  const [rebindDomain, setRebindDomain] = useState('')

  // 确认类操作（吊销/重置/删除）
  const [confirm, setConfirm] = useState<{
    title: string
    desc: string
    action: string
    fn: () => Promise<unknown>
    ok: string
    destructive?: boolean
  } | null>(null)

  async function doSimple(fn: () => Promise<unknown>, okMsg: string) {
    try {
      await fn()
      toast.success(okMsg)
      load(query)
    } catch (err) {
      toast.error(extractError(err))
    }
  }

  function onAction(key: string, l: License) {
    switch (key) {
      case 'edit':
        setEditTarget(l)
        setEditForm({
          customer_name: l.customer_name,
          customer_contact: l.customer_contact,
          remark: l.remark,
        })
        setShowEdit(true)
        break
      case 'renew':
        setRenewTarget(l)
        setRenewForm({ mode: 'days', days: 365 })
        setShowRenew(true)
        break
      case 'rebind':
        setRebindTarget(l)
        setRebindDomain(l.domain)
        setShowRebind(true)
        break
      case 'revoke':
        setConfirm({
          title: '吊销授权',
          desc: `吊销后客户站点将在下次心跳时停止对外服务。确定吊销 ${l.code}？`,
          action: '吊销',
          ok: '已吊销',
          fn: () => licenseApi.revoke(l.id),
        })
        break
      case 'restore':
        doSimple(() => licenseApi.restore(l.id), '已恢复')
        break
      case 'reset':
        setConfirm({
          title: '重置授权',
          desc: `重置将解绑域名 ${l.domain || ''} 并恢复为未激活状态，有效期将在下次激活时重新起算。确定重置？`,
          action: '重置',
          ok: '已重置',
          fn: () => licenseApi.reset(l.id),
        })
        break
      case 'delete':
        setConfirm({
          title: '删除授权',
          desc: `删除后不可恢复，客户站点将无法通过校验。确定删除 ${l.code}？`,
          action: '删除',
          ok: '已删除',
          destructive: true,
          fn: () => licenseApi.remove(l.id),
        })
        break
    }
  }

  function actionItems(l: License) {
    const opts: { label: string; key: string; disabled?: boolean }[] = [
      { label: '编辑客户信息', key: 'edit' },
      { label: '续期', key: 'renew', disabled: l.status === 'revoked' },
      { label: '改绑域名', key: 'rebind', disabled: l.status === 'unactivated' },
    ]
    if (l.status === 'revoked') opts.push({ label: '恢复授权', key: 'restore' })
    else opts.push({ label: '吊销授权', key: 'revoke' })
    opts.push({ label: '重置（解绑重来）', key: 'reset', disabled: l.status === 'unactivated' })
    opts.push({ label: '删除', key: 'delete' })
    return opts
  }

  function expiryText(l: License) {
    if (l.status === 'unactivated') {
      return l.duration_type === 'permanent'
        ? '永久（激活后）'
        : `${l.duration_days} 天（激活起算）`
    }
    if (!l.expires_at) return '永久'
    return formatTime(l.expires_at).slice(0, 10)
  }

  async function submitEdit() {
    if (!editTarget) return
    setActionBusy(true)
    try {
      await licenseApi.update(editTarget.id, editForm)
      toast.success('已保存')
      setShowEdit(false)
      load(query)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setActionBusy(false)
    }
  }

  async function submitRenew() {
    if (!renewTarget) return
    setActionBusy(true)
    try {
      if (renewForm.mode === 'permanent') await licenseApi.renew(renewTarget.id, { permanent: true })
      else await licenseApi.renew(renewTarget.id, { days: renewForm.days })
      toast.success('已续期')
      setShowRenew(false)
      load(query)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setActionBusy(false)
    }
  }

  async function submitRebind() {
    if (!rebindTarget) return
    setActionBusy(true)
    try {
      await licenseApi.rebind(rebindTarget.id, rebindDomain)
      toast.success('已改绑')
      setShowRebind(false)
      load(query)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setActionBusy(false)
    }
  }

  const detailRows = useMemo(() => {
    if (!detail) return []
    return [
      ['产品', detail.product_name || '-'],
      ['客户', detail.customer_name || '-'],
      ['联系方式', detail.customer_contact || '-'],
      ['期限类型', durationLabels[detail.duration_type] ?? detail.duration_type],
      [
        '到期时间',
        detail.status === 'unactivated'
          ? detail.duration_type === 'permanent'
            ? '永久（激活后）'
            : `激活后 ${detail.duration_days} 天`
          : detail.expires_at
            ? formatTime(detail.expires_at)
            : '永久',
      ],
      ['绑定域名', detail.domain || '-'],
      ['激活时间', formatTime(detail.activated_at)],
      ['最近心跳', formatTime(detail.last_heartbeat_at)],
      ['运行版本', detail.last_version || '-'],
      ['来源 IP', detail.last_ip || '-'],
      ['创建时间', formatTime(detail.created_at)],
    ] as [string, string][]
  }, [detail])

  return (
    <PageContainer>
      <PageHeader
        title="授权管理"
        sub="发放、续期、改绑、吊销客户授权"
        actions={<Button onClick={openCreate}>发放授权</Button>}
      />

      <Card className="gap-0 p-4">
        {/* 筛选 */}
        <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
          <Select
            value={query.product_id ? String(query.product_id) : ALL}
            onValueChange={(v) => patchQuery({ product_id: v === ALL ? null : Number(v) })}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="全部产品" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>全部产品</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={query.status ?? ALL}
            onValueChange={(v) => patchQuery({ status: v === ALL ? null : v })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>全部状态</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            className="w-[240px]"
            placeholder="搜索授权码 / 客户 / 域名"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') patchQuery({ q: qInput })
            }}
          />
          <Button variant="secondary" onClick={() => patchQuery({ q: qInput })}>
            搜索
          </Button>
        </div>

        {/* 表格 */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>授权码</TableHead>
                <TableHead>产品</TableHead>
                <TableHead>客户</TableHead>
                <TableHead>域名</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>期限</TableHead>
                <TableHead>到期</TableHead>
                <TableHead>最近心跳</TableHead>
                <TableHead>版本</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                items.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <span
                        className="mono cursor-pointer hover:text-emerald-600"
                        title="点击复制"
                        onClick={() => copyCode(l.code)}
                      >
                        {l.code}
                      </span>
                    </TableCell>
                    <TableCell>{l.product_name ?? '-'}</TableCell>
                    <TableCell className="max-w-[120px] truncate">{l.customer_name || '-'}</TableCell>
                    <TableCell className="max-w-[170px] truncate">{l.domain || '-'}</TableCell>
                    <TableCell>
                      <Badge className={statusBadgeClass[l.effective_status as LicenseStatus]}>
                        {statusLabels[l.effective_status as LicenseStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell>{durationLabels[l.duration_type] ?? l.duration_type}</TableCell>
                    <TableCell>{expiryText(l)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.last_heartbeat_at ? formatTime(l.last_heartbeat_at) : '-'}
                    </TableCell>
                    <TableCell className="mono">{l.last_version || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => openDetail(l)}>
                          详情
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                              <MoreHorizontal size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {actionItems(l).map((o) => (
                              <DropdownMenuItem
                                key={o.key}
                                disabled={o.disabled}
                                variant={o.key === 'delete' ? 'destructive' : 'default'}
                                onClick={() => onAction(o.key, l)}
                              >
                                {o.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 分页 */}
        <div className="mt-3.5 flex items-center justify-end gap-3 text-sm">
          <span className="text-muted-foreground">共 {total} 条</span>
          <Select
            value={String(query.page_size)}
            onValueChange={(v) => patchQuery({ page_size: Number(v) })}
          >
            <SelectTrigger className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[20, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} 条/页
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            disabled={query.page <= 1}
            onClick={() => patchQuery({ page: query.page - 1 }, false)}
          >
            上一页
          </Button>
          <span className="tabular-nums">
            {query.page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={query.page >= totalPages}
            onClick={() => patchQuery({ page: query.page + 1 }, false)}
          >
            下一页
          </Button>
        </div>
      </Card>

      {/* 发放授权 */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>发放授权</DialogTitle>
          </DialogHeader>
          {createdCodes.length === 0 ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>产品 *</Label>
                <Select
                  value={createForm.product_id ? String(createForm.product_id) : ''}
                  onValueChange={(v) => setCreateForm((f) => ({ ...f, product_id: Number(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择产品" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label>客户名称</Label>
                  <Input
                    value={createForm.customer_name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, customer_name: e.target.value }))}
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label>联系方式</Label>
                  <Input
                    value={createForm.customer_contact}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, customer_contact: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>授权期限 *</Label>
                <div>
                  <Segmented
                    value={createForm.duration_type}
                    onChange={(v) => setCreateForm((f) => ({ ...f, duration_type: v }))}
                    options={[
                      { label: '年度（365 天）', value: 'yearly' },
                      { label: '永久', value: 'permanent' },
                      { label: '自定义', value: 'custom' },
                    ]}
                  />
                </div>
              </div>
              {createForm.duration_type === 'custom' && (
                <div className="space-y-1.5">
                  <Label>自定义天数</Label>
                  <Input
                    type="number"
                    min={1}
                    max={36500}
                    value={createForm.duration_days}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, duration_days: Number(e.target.value) }))
                    }
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>生成数量</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={createForm.count}
                  onChange={(e) => setCreateForm((f) => ({ ...f, count: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>备注</Label>
                <Textarea
                  rows={2}
                  value={createForm.remark}
                  onChange={(e) => setCreateForm((f) => ({ ...f, remark: e.target.value }))}
                />
              </div>
              <p className="text-xs text-muted-foreground">有效期从客户激活时起算，而非发放时。</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreate(false)}>
                  取消
                </Button>
                <Button disabled={creating} onClick={submitCreate}>
                  {creating ? '生成中...' : '生成授权码'}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm">以下授权码已生成，请复制发给客户：</p>
              <div className="rounded-md border bg-muted/40 p-3">
                {createdCodes.map((code) => (
                  <div key={code} className="mono leading-[1.9]">
                    {code}
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreate(false)}>
                  关闭
                </Button>
                <Button onClick={() => copyCode(createdCodes.join('\n'))}>复制全部</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 详情 */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="mono">{detail ? detail.code : '授权详情'}</DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="max-h-[70vh] overflow-y-auto pr-1">
              <div className="mb-2 flex items-center gap-2">
                <Badge className={statusBadgeClass[detail.effective_status as LicenseStatus]}>
                  {statusLabels[detail.effective_status as LicenseStatus]}
                </Badge>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-md border p-3 text-sm">
                {detailRows.map(([k, v]) => (
                  <div key={k} className="flex flex-col">
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="mt-0.5 break-all">{v}</dd>
                  </div>
                ))}
                {detail.remark && (
                  <div className="col-span-2 flex flex-col">
                    <dt className="text-xs text-muted-foreground">备注</dt>
                    <dd className="mt-0.5">{detail.remark}</dd>
                  </div>
                )}
              </dl>

              <Tabs defaultValue="events" className="mt-4">
                <TabsList>
                  <TabsTrigger value="events">操作记录</TabsTrigger>
                  <TabsTrigger value="heartbeats">心跳记录（近 50 条）</TabsTrigger>
                </TabsList>
                <TabsContent value="events">
                  {detailEvents.length ? (
                    <ul className="mt-2 space-y-3">
                      {detailEvents.map((e) => (
                        <li key={e.id} className="border-l-2 border-emerald-500/40 pl-3">
                          <div className="text-sm font-medium">
                            {eventLabels[e.type] ?? e.type}
                          </div>
                          <div className="text-[13px] text-muted-foreground">{e.detail}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatTime(e.created_at)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="py-10 text-center text-sm text-muted-foreground">暂无记录</div>
                  )}
                </TabsContent>
                <TabsContent value="heartbeats">
                  {detailHeartbeats.length ? (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {detailHeartbeats.map((hb) => (
                        <div key={hb.id} className="flex items-center gap-2.5 text-[13px]">
                          <Badge
                            className={
                              hb.result === 'active'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            }
                          >
                            {hb.result === 'active' ? '正常' : hb.result}
                          </Badge>
                          <span className="mono min-w-[52px]">{hb.version || '-'}</span>
                          <span className="text-muted-foreground">{hb.domain}</span>
                          <span className="mono text-muted-foreground">{hb.ip}</span>
                          <span className="ml-auto text-muted-foreground">
                            {formatTime(hb.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-10 text-center text-sm text-muted-foreground">暂无心跳</div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">加载中...</div>
          )}
        </DialogContent>
      </Dialog>

      {/* 编辑客户信息 */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>编辑客户信息</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>客户名称</Label>
              <Input
                value={editForm.customer_name}
                onChange={(e) => setEditForm((f) => ({ ...f, customer_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>联系方式</Label>
              <Input
                value={editForm.customer_contact}
                onChange={(e) => setEditForm((f) => ({ ...f, customer_contact: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>备注</Label>
              <Textarea
                rows={2}
                value={editForm.remark}
                onChange={(e) => setEditForm((f) => ({ ...f, remark: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEdit(false)}>
                取消
              </Button>
              <Button disabled={actionBusy} onClick={submitEdit}>
                保存
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* 续期 */}
      <Dialog open={showRenew} onOpenChange={setShowRenew}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>续期授权</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>续期方式</Label>
              <div>
                <Segmented
                  value={renewForm.mode}
                  onChange={(v) => setRenewForm((f) => ({ ...f, mode: v }))}
                  options={[
                    { label: '增加天数', value: 'days' },
                    { label: '转为永久', value: 'permanent' },
                  ]}
                />
              </div>
            </div>
            {renewForm.mode === 'days' && (
              <div className="space-y-1.5">
                <Label>天数</Label>
                <Input
                  type="number"
                  min={1}
                  max={36500}
                  value={renewForm.days}
                  onChange={(e) => setRenewForm((f) => ({ ...f, days: Number(e.target.value) }))}
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              未过期授权从原到期日累加；已过期授权从今天起算。
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRenew(false)}>
                取消
              </Button>
              <Button disabled={actionBusy} onClick={submitRenew}>
                确认续期
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* 改绑域名 */}
      <Dialog open={showRebind} onOpenChange={setShowRebind}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>改绑域名</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>新域名</Label>
              <Input
                placeholder="如：example.com"
                value={rebindDomain}
                onChange={(e) => setRebindDomain(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              改绑后旧域名站点将无法通过校验，新域名站点无需重新激活。
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRebind(false)}>
                取消
              </Button>
              <Button disabled={actionBusy} onClick={submitRebind}>
                确认改绑
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* 吊销 / 重置 / 删除 确认 */}
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirm?.destructive
                  ? 'bg-destructive text-white hover:bg-destructive/90'
                  : undefined
              }
              onClick={() => {
                if (confirm) doSimple(confirm.fn, confirm.ok)
              }}
            >
              {confirm?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  )
}
