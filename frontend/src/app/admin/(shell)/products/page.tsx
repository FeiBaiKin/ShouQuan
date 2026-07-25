'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { extractError, productApi } from '@/lib/api'
import type { Product } from '@/lib/types'
import { formatDate } from '@/lib/format'
import { PageContainer, PageHeader } from '@/components/admin/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
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
} from '@/components/ui/alert-dialog'

type ProductForm = { name: string; slug: string; remark: string }

const emptyForm: ProductForm = { name: '', slug: '', remark: '' }

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)

  const [removeTarget, setRemoveTarget] = useState<Product | null>(null)

  async function load() {
    setLoading(true)
    try {
      const { data } = await productApi.list()
      setProducts(data)
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
    setForm({ ...emptyForm })
    setShowModal(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({ name: p.name, slug: p.slug, remark: p.remark })
    setShowModal(true)
  }

  async function save() {
    if (!form.name.trim()) {
      toast.warning('请填写产品名称')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await productApi.update(editing.id, { name: form.name, remark: form.remark })
        toast.success('已保存')
      } else {
        await productApi.create(form)
        toast.success('产品已创建，公钥已生成')
      }
      setShowModal(false)
      await load()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  async function remove(p: Product) {
    try {
      await productApi.remove(p.id)
      toast.success('已删除')
      await load()
    } catch (err) {
      toast.error(extractError(err))
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${label}已复制`),
      () => toast.error('复制失败'),
    )
  }

  return (
    <PageContainer>
      <PageHeader
        title="产品管理"
        sub="每个产品持有独立的签名密钥对，公钥需嵌入接入方程序"
        actions={<Button onClick={openCreate}>新建产品</Button>}
      />

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[112px] rounded-xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-sm text-muted-foreground">
          <span>还没有产品</span>
          <Button onClick={openCreate}>创建第一个产品</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <Card key={p.id} size="sm" className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold">{p.name}</span>
                    <Badge variant="secondary">
                      <span className="mono">{p.slug}</span>
                    </Badge>
                    {p.latest_version && (
                      <Badge className="border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        <span className="mono">v{p.latest_version}</span>
                      </Badge>
                    )}
                  </div>
                  <div className="text-[13px] text-muted-foreground">
                    授权 {p.license_count ?? 0} 个 · 版本 {p.release_count ?? 0} 个 · 创建于{' '}
                    {formatDate(p.created_at)}
                    {p.remark ? ` · ${p.remark}` : ''}
                  </div>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-xs text-muted-foreground">公钥</span>
                    <code className="mono max-w-[420px] truncate text-xs text-muted-foreground opacity-75">
                      {p.public_key}
                    </code>
                    <Button
                      variant="link"
                      size="xs"
                      className="h-auto px-0"
                      onClick={() => copy(p.public_key, '公钥')}
                    >
                      复制
                    </Button>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                    编辑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setRemoveTarget(p)}
                  >
                    删除
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 新增 / 编辑弹窗 */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑产品' : '新建产品'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>
                产品名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="如：XZJI 资源站"
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                产品标识（slug） <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="如：xzji（创建后不可修改）"
                disabled={!!editing}
              />
            </div>
            <div className="space-y-1.5">
              <Label>备注</Label>
              <Textarea
                value={form.remark}
                onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              取消
            </Button>
            <Button onClick={save} disabled={saving}>
              {editing ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除产品「{removeTarget?.name}」？仅当其下无授权和版本时可删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (removeTarget) remove(removeTarget)
                setRemoveTarget(null)
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  )
}
