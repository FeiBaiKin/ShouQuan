'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Ticket } from 'lucide-react'
import { extractError, planApi, productApi } from '@/lib/api'
import type { DurationType, PricingPlan, Product } from '@/lib/types'
import { PageContainer, PageHeader } from '@/components/admin/page-header'
import { EmptyState } from '@/components/admin/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PlanForm {
  product_id: number | null
  name: string
  price: number
  duration_type: DurationType
  duration_days: number
  features: string
  remark: string
  sort_order: number
  enabled: boolean
}

const durationOptions: { label: string; value: DurationType }[] = [
  { label: '年度（365 天）', value: 'yearly' },
  { label: '永久', value: 'permanent' },
  { label: '自定义天数', value: 'custom' },
]

function durationLabel(t: string, days: number): string {
  if (t === 'permanent') return '永久'
  if (t === 'yearly') return '365 天'
  return `${days} 天`
}

const emptyForm: PlanForm = {
  product_id: null,
  name: '',
  price: 0,
  duration_type: 'yearly',
  duration_days: 365,
  features: '',
  remark: '',
  sort_order: 0,
  enabled: true,
}

export default function PlansPage() {
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<PricingPlan | null>(null)
  const [form, setForm] = useState<PlanForm>(emptyForm)

  const productOptions = useMemo(
    () => products.map((p) => ({ label: p.name, value: p.id })),
    [products],
  )

  async function load() {
    setLoading(true)
    try {
      const [planResp, prodResp] = await Promise.all([planApi.list(), productApi.list()])
      setPlans(planResp.data)
      setProducts(prodResp.data)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function openCreate() {
    setEditing(null)
    setForm({
      ...emptyForm,
      product_id: products[0]?.id ?? null,
    })
    setShowModal(true)
  }

  function openEdit(p: PricingPlan) {
    setEditing(p)
    setForm({
      product_id: p.product_id,
      name: p.name,
      price: p.price,
      duration_type: p.duration_type,
      duration_days: p.duration_days,
      features: p.features,
      remark: p.remark,
      sort_order: p.sort_order,
      enabled: p.enabled,
    })
    setShowModal(true)
  }

  async function save() {
    if (!form.product_id) {
      toast.warning('请选择产品')
      return
    }
    if (!form.name.trim()) {
      toast.warning('请填写套餐名称')
      return
    }
    if (form.price <= 0) {
      toast.warning('价格需大于 0')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        product_id: form.product_id as number,
        duration_type: form.duration_type as DurationType,
      }
      if (editing) {
        await planApi.update(editing.id, payload)
        toast.success('已保存')
      } else {
        await planApi.create(payload)
        toast.success('已创建')
      }
      setShowModal(false)
      await load()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  async function remove(p: PricingPlan) {
    try {
      await planApi.remove(p.id)
      toast.success('已删除')
      await load()
    } catch (err) {
      toast.error(extractError(err))
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="套餐管理"
        sub="为产品配置可购买的授权套餐"
        actions={
          <Button onClick={openCreate}>
            <Plus />
            新建套餐
          </Button>
        }
      />

      <Card className="gap-0 overflow-hidden p-0">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-md" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">ID</TableHead>
                <TableHead className="w-[140px]">产品</TableHead>
                <TableHead className="w-[120px]">套餐名</TableHead>
                <TableHead className="w-[100px]">价格</TableHead>
                <TableHead className="w-[110px]">期限</TableHead>
                <TableHead className="w-[70px]">排序</TableHead>
                <TableHead className="w-[80px]">状态</TableHead>
                <TableHead className="w-[140px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length ? (
                plans.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="mono">{r.id}</TableCell>
                    <TableCell>{r.product_name}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="mono">{`¥${r.price}`}</TableCell>
                    <TableCell>{durationLabel(r.duration_type, r.duration_days)}</TableCell>
                    <TableCell className="mono">{r.sort_order}</TableCell>
                    <TableCell>
                      {r.enabled ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent">
                          启用
                        </Badge>
                      ) : (
                        <Badge className="bg-muted text-muted-foreground border-transparent">
                          禁用
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                          编辑
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                            >
                              删除
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>确认删除</AlertDialogTitle>
                              <AlertDialogDescription>
                                确认删除该套餐？已购买的订单不受影响。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                onClick={() => remove(r)}
                              >
                                删除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="p-0">
                    <EmptyState
                      icon={Ticket}
                      title="暂无套餐"
                      hint="为产品配置可购买的授权套餐后，将展示在前台购买页"
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑套餐' : '新建套餐'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>产品</Label>
              <Select
                value={form.product_id != null ? String(form.product_id) : undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, product_id: Number(v) }))}
                disabled={!!editing}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择产品" />
                </SelectTrigger>
                <SelectContent>
                  {productOptions.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>套餐名称</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="如 年付 / 永久 / 季付"
              />
            </div>

            <div className="flex gap-3">
              <div className="space-y-1.5">
                <Label>价格（元）</Label>
                <Input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                  className="w-40"
                />
              </div>
              <div className="space-y-1.5">
                <Label>排序</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
                  className="w-32"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>期限类型</Label>
              <Select
                value={form.duration_type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, duration_type: v as DurationType }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {durationOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.duration_type === 'custom' && (
              <div className="space-y-1.5">
                <Label>天数</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.duration_days}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, duration_days: Number(e.target.value) }))
                  }
                  className="w-40"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>特性（JSON 数组，每行一条）</Label>
              <Textarea
                rows={4}
                value={form.features}
                onChange={(e) => setForm((f) => ({ ...f, features: e.target.value }))}
                placeholder='["商业授权","一年更新","技术支持"]'
              />
            </div>

            <div className="space-y-1.5">
              <Label>备注</Label>
              <Textarea
                rows={2}
                value={form.remark}
                onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-2">
              <Label>启用</Label>
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              取消
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
