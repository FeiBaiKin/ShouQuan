'use client'

import { useEffect, useRef, useState, type DragEvent } from 'react'
import { toast } from 'sonner'
import { UploadCloud, X } from 'lucide-react'
import { extractError, productApi, releaseApi } from '@/lib/api'
import type { Product, Release } from '@/lib/types'
import { formatSize, formatTime } from '@/lib/format'
import { PageContainer, PageHeader } from '@/components/admin/page-header'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

// 产品筛选「全部」哨兵值（Radix Select 不允许空字符串项值）
const ALL = '__all__'

type ConfirmState =
  | { kind: 'publish'; release: Release }
  | { kind: 'delete'; release: Release }
  | null

export default function ReleasesPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(false)
  const [filterProduct, setFilterProduct] = useState<number | null>(null)

  async function load(productId: number | null = filterProduct) {
    setLoading(true)
    try {
      const { data } = await releaseApi.list(productId)
      setReleases(data)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    productApi
      .list()
      .then(({ data }) => setProducts(data))
      .catch((e) => toast.error(extractError(e)))
    load(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onFilterChange(value: string) {
    const id = value === ALL ? null : Number(value)
    setFilterProduct(id)
    load(id)
  }

  function copySha(sha: string) {
    if (!sha) return
    navigator.clipboard.writeText(sha).then(
      () => toast.success('SHA256 已复制'),
      () => toast.error('复制失败'),
    )
  }

  // ---- 发布 / 撤回 ----
  async function doPublish(r: Release) {
    try {
      await releaseApi.publish(r.id)
      toast.success('已发布')
      await load()
    } catch (err) {
      toast.error(extractError(err))
    }
  }

  async function doUnpublish(r: Release) {
    try {
      await releaseApi.unpublish(r.id)
      toast.success('已撤回，客户端将不再收到该版本')
      await load()
    } catch (err) {
      toast.error(extractError(err))
    }
  }

  async function doRemove(r: Release) {
    try {
      await releaseApi.remove(r.id)
      toast.success('已删除')
      await load()
    } catch (err) {
      toast.error(extractError(err))
    }
  }

  // ---- 确认弹窗（发布 / 删除） ----
  const [confirm, setConfirm] = useState<ConfirmState>(null)

  async function onConfirm() {
    if (!confirm) return
    const { kind, release } = confirm
    setConfirm(null)
    if (kind === 'publish') await doPublish(release)
    else await doRemove(release)
  }

  // ---- 上传 ----
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [uploadProductId, setUploadProductId] = useState<number | null>(null)
  const [uploadVersion, setUploadVersion] = useState('')
  const [uploadChangelog, setUploadChangelog] = useState('')
  const [uploadForced, setUploadForced] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function openUpload() {
    setUploadProductId(filterProduct)
    setUploadVersion('')
    setUploadChangelog('')
    setUploadForced(false)
    setUploadFile(null)
    setUploadPercent(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setShowUpload(true)
  }

  function pickFile(f: File | null) {
    setUploadFile(f)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (uploading) return
    const f = e.dataTransfer.files?.[0] ?? null
    if (f) pickFile(f)
  }

  async function submitUpload() {
    if (!uploadProductId || !uploadVersion.trim() || !uploadFile) {
      toast.warning('请选择产品、填写版本号并选择更新包文件')
      return
    }
    setUploading(true)
    setUploadPercent(0)
    try {
      const form = new FormData()
      form.append('product_id', String(uploadProductId))
      form.append('version', uploadVersion.trim())
      form.append('changelog', uploadChangelog)
      form.append('forced', uploadForced ? '1' : '0')
      form.append('file', uploadFile)
      await releaseApi.upload(form, (p) => setUploadPercent(p))
      toast.success('上传成功（默认未发布，确认无误后点「发布」）')
      setShowUpload(false)
      await load()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setUploading(false)
    }
  }

  // ---- 编辑 ----
  const [showEdit, setShowEdit] = useState(false)
  const [editTarget, setEditTarget] = useState<Release | null>(null)
  const [editChangelog, setEditChangelog] = useState('')
  const [editForced, setEditForced] = useState(false)
  const [editBusy, setEditBusy] = useState(false)

  function openEdit(r: Release) {
    setEditTarget(r)
    setEditChangelog(r.changelog)
    setEditForced(r.forced)
    setShowEdit(true)
  }

  async function submitEdit() {
    if (!editTarget) return
    setEditBusy(true)
    try {
      await releaseApi.update(editTarget.id, {
        changelog: editChangelog,
        forced: editForced,
      })
      toast.success('已保存')
      setShowEdit(false)
      await load()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setEditBusy(false)
    }
  }

  const COLS = 10

  return (
    <PageContainer>
      <PageHeader
        title="版本管理"
        sub="上传更新包并发布，客户站点通过心跳感知新版本"
        actions={
          <>
            <Select value={filterProduct == null ? ALL : String(filterProduct)} onValueChange={onFilterChange}>
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
            <Button onClick={openUpload}>上传新版本</Button>
          </>
        }
      />

      <Card size="sm" className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">产品</TableHead>
              <TableHead className="w-[110px]">版本</TableHead>
              <TableHead className="w-[90px]">状态</TableHead>
              <TableHead className="w-[90px]">强制更新</TableHead>
              <TableHead className="w-[90px]">大小</TableHead>
              <TableHead className="w-[150px]">SHA256</TableHead>
              <TableHead className="w-[70px]">下载</TableHead>
              <TableHead>更新日志</TableHead>
              <TableHead className="w-[140px]">上传时间</TableHead>
              <TableHead className="w-[200px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={COLS} className="py-10 text-center text-muted-foreground">
                  加载中…
                </TableCell>
              </TableRow>
            ) : releases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLS} className="py-10 text-center text-muted-foreground">
                  暂无版本
                </TableCell>
              </TableRow>
            ) : (
              releases.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.product?.name ?? '-'}</TableCell>
                  <TableCell className="mono font-semibold">{r.version}</TableCell>
                  <TableCell>
                    {r.published ? (
                      <Badge className="border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        已发布
                      </Badge>
                    ) : (
                      <Badge className="border-transparent bg-muted text-muted-foreground">
                        未发布
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.forced ? (
                      <Badge className="border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        强制
                      </Badge>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="mono">{formatSize(r.file_size)}</TableCell>
                  <TableCell>
                    {r.sha256 ? (
                      <span
                        className="mono cursor-pointer text-xs opacity-75"
                        title={`${r.sha256}（点击复制）`}
                        onClick={() => copySha(r.sha256)}
                      >
                        {r.sha256.slice(0, 16)}…
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="mono">{r.downloads}</TableCell>
                  <TableCell
                    className="max-w-[280px] truncate text-muted-foreground"
                    title={r.changelog || undefined}
                  >
                    {r.changelog || '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatTime(r.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {r.published ? (
                        <Button size="xs" variant="outline" onClick={() => doUnpublish(r)}>
                          撤回
                        </Button>
                      ) : (
                        <Button size="xs" onClick={() => setConfirm({ kind: 'publish', release: r })}>
                          发布
                        </Button>
                      )}
                      <Button size="xs" variant="outline" onClick={() => openEdit(r)}>
                        编辑
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setConfirm({ kind: 'delete', release: r })}
                      >
                        删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* 上传弹窗 */}
      <Dialog
        open={showUpload}
        onOpenChange={(o) => {
          if (uploading) return // 上传中禁止关闭
          setShowUpload(o)
        }}
      >
        <DialogContent
          className="sm:max-w-[520px]"
          showCloseButton={!uploading}
          onInteractOutside={(e) => {
            if (uploading) e.preventDefault()
          }}
          onEscapeKeyDown={(e) => {
            if (uploading) e.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle>上传新版本</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>
                产品 <span className="text-destructive">*</span>
              </Label>
              <Select
                value={uploadProductId == null ? undefined : String(uploadProductId)}
                onValueChange={(v) => setUploadProductId(Number(v))}
                disabled={uploading}
              >
                <SelectTrigger className="w-full">
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

            <div className="space-y-1.5">
              <Label>
                版本号 <span className="text-destructive">*</span>
              </Label>
              <Input
                className="mono"
                placeholder="如：1.2.0"
                value={uploadVersion}
                disabled={uploading}
                onChange={(e) => setUploadVersion(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>更新日志</Label>
              <Textarea
                rows={4}
                placeholder="本次更新内容，将展示给客户站点管理员"
                value={uploadChangelog}
                disabled={uploading}
                onChange={(e) => setUploadChangelog(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>强制更新</Label>
              <div className="flex items-center gap-2">
                <Switch checked={uploadForced} disabled={uploading} onCheckedChange={setUploadForced} />
                <span className="text-xs text-muted-foreground">
                  开启后客户端应强制升级（由接入方实现具体策略）
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>
                更新包文件 <span className="text-destructive">*</span>
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                disabled={uploading}
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
              <div
                role="button"
                tabIndex={0}
                onClick={() => !uploading && fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (!uploading && (e.key === 'Enter' || e.key === ' ')) fileInputRef.current?.click()
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input px-4 py-6 text-center transition-colors ${
                  uploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-ring hover:bg-muted/50'
                }`}
              >
                <UploadCloud className="size-6 text-muted-foreground" />
                {uploadFile ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="mono max-w-[360px] truncate">{uploadFile.name}</span>
                    <span className="text-xs text-muted-foreground">
                      （{formatSize(uploadFile.size)}）
                    </span>
                    {!uploading && (
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation()
                          pickFile(null)
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    点击或拖拽更新包到此处（如 tar.gz / zip）
                  </span>
                )}
              </div>
            </div>

            {uploading && (
              <div className="space-y-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${uploadPercent}%` }}
                  />
                </div>
                <div className="mono text-right text-xs text-muted-foreground">{uploadPercent}%</div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={uploading} onClick={() => setShowUpload(false)}>
              取消
            </Button>
            <Button disabled={uploading} onClick={submitUpload}>
              {uploading ? '上传中…' : '上传'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑弹窗 */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>编辑版本 {editTarget?.version ?? ''}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>更新日志</Label>
              <Textarea
                rows={4}
                value={editChangelog}
                onChange={(e) => setEditChangelog(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>强制更新</Label>
              <div>
                <Switch checked={editForced} onCheckedChange={setEditForced} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>
              取消
            </Button>
            <Button disabled={editBusy} onClick={submitEdit}>
              {editBusy ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 发布 / 删除 确认 */}
      <AlertDialog open={confirm != null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === 'delete' ? '删除版本' : '发布版本'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === 'delete'
                ? `将删除版本记录及服务器上的更新包文件。确定删除 ${confirm?.release.version}？`
                : `发布后所有有效授权站点心跳时将收到 ${confirm?.release.version} 的更新提示。确定发布？`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm?.kind === 'delete' ? 'destructive' : 'default'}
              onClick={onConfirm}
            >
              {confirm?.kind === 'delete' ? '删除' : '发布'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  )
}
