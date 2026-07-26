'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Copy, Receipt, Search } from 'lucide-react'
import { extractError, orderApi, productApi } from '@/lib/api'
import type { Product, PurchaseOrder } from '@/lib/types'
import { formatTime } from '@/lib/format'
import { PageContainer, PageHeader } from '@/components/admin/page-header'
import { EmptyState } from '@/components/admin/empty-state'
import { TablePager } from '@/components/admin/table-pager'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Skeleton } from '@/components/ui/skeleton'

// Radix Select 不允许空字符串作为 item value，用 ALL 作“全部”哨兵值，查询时转回空。
const ALL = 'all'

const statusOptions = [
  { label: '全部', value: ALL },
  { label: '待支付', value: 'pending' },
  { label: '已支付', value: 'paid' },
  { label: '已过期', value: 'expired' },
  { label: '已关闭', value: 'closed' },
]
const methodOptions = [
  { label: '全部', value: ALL },
  { label: '支付宝', value: 'alipay' },
  { label: '微信', value: 'wechat' },
]

const statusMap: Record<string, { label: string; className: string }> = {
  pending: {
    label: '待支付',
    className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent',
  },
  paid: {
    label: '已支付',
    className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent',
  },
  expired: { label: '已过期', className: 'bg-muted text-muted-foreground border-transparent' },
  closed: { label: '已关闭', className: 'bg-muted text-muted-foreground border-transparent' },
}
const methodMap: Record<string, string> = { alipay: '支付宝', wechat: '微信' }

export default function OrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // 提交查询用的筛选值；输入框有独立的草稿 state，回车/点查询时才生效
  const [status, setStatus] = useState('')
  const [productId, setProductId] = useState('')
  const [method, setMethod] = useState('')
  const [q, setQ] = useState('')
  const [qDraft, setQDraft] = useState('')

  // 加载产品下拉
  useEffect(() => {
    productApi
      .list()
      .then(({ data }) => setProducts(data))
      .catch(() => {
        // ignore
      })
  }, [])

  // 筛选/分页变化时重新拉取订单
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    orderApi
      .list({
        status: status || undefined,
        product_id: productId ? Number(productId) : undefined,
        method: method || undefined,
        q: q || undefined,
        page,
        page_size: pageSize,
      })
      .then(({ data }) => {
        if (cancelled) return
        setOrders(data.items)
        setTotal(data.total)
      })
      .catch((err) => {
        if (!cancelled) toast.error(extractError(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [status, productId, method, q, page, pageSize])

  function applySearch() {
    setPage(1)
    setQ(qDraft)
  }

  function onFilterChange(setter: (v: string) => void, value: string) {
    setPage(1)
    setter(value === ALL ? '' : value)
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => toast.success('已复制'))
  }

  const COLS = 10

  return (
    <PageContainer>
      <PageHeader title="订单管理" sub="用户购买授权的订单记录" />

      <Card className="gap-0 overflow-hidden p-0">
        {/* 筛选栏 */}
        <div className="flex flex-wrap items-center gap-2.5 border-b px-4 py-3">
        <Select
          value={status || ALL}
          onValueChange={(v) => onFilterChange(setStatus, v)}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={productId || ALL}
          onValueChange={(v) => onFilterChange(setProductId, v)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="产品" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={method || ALL}
          onValueChange={(v) => onFilterChange(setMethod, v)}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="支付方式" />
          </SelectTrigger>
          <SelectContent>
            {methodOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          className="w-[240px]"
          placeholder="订单号 / 邮箱 / 流水号"
          value={qDraft}
          onChange={(e) => setQDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') applySearch()
          }}
        />

        <Button onClick={applySearch}>
          <Search />
          查询
        </Button>
        </div>

        {/* 订单表格 */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">订单号</TableHead>
              <TableHead className="w-[120px]">产品</TableHead>
              <TableHead className="w-[100px]">套餐</TableHead>
              <TableHead className="w-[180px]">邮箱</TableHead>
              <TableHead className="w-[90px]">金额</TableHead>
              <TableHead className="w-[90px]">支付方式</TableHead>
              <TableHead className="w-[90px]">状态</TableHead>
              <TableHead className="w-[200px]">授权码</TableHead>
              <TableHead className="w-[150px]">创建时间</TableHead>
              <TableHead className="w-[150px]">支付时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: COLS }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : orders.length ? (
              orders.map((r) => {
                const s = statusMap[r.status] ?? {
                  label: r.status,
                  className: 'bg-muted text-muted-foreground border-transparent',
                }
                return (
                  <TableRow key={r.id}>
                    <TableCell className="mono truncate" title={r.order_no}>
                      {r.order_no}
                    </TableCell>
                    <TableCell>{r.product_name || '-'}</TableCell>
                    <TableCell>{r.plan_name || '-'}</TableCell>
                    <TableCell className="truncate" title={r.email}>
                      {r.email}
                    </TableCell>
                    <TableCell className="mono">¥{r.amount}</TableCell>
                    <TableCell>{methodMap[r.payment_method] || r.payment_method || '-'}</TableCell>
                    <TableCell>
                      <Badge className={s.className}>{s.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.license_code ? (
                        <div className="flex items-center gap-1">
                          <span className="mono truncate" title={r.license_code}>
                            {r.license_code}
                          </span>
                          <Button
                            variant="link"
                            size="xs"
                            className="h-auto px-0"
                            onClick={() => copyCode(r.license_code!)}
                          >
                            <Copy />
                            复制
                          </Button>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTime(r.created_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.paid_at ? formatTime(r.paid_at) : '-'}
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={COLS} className="p-0">
                  <EmptyState icon={Receipt} title="暂无订单" hint="用户从前台购买后会出现在这里" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* 分页控件（服务端分页） */}
        <div className="border-t px-4 py-3">
          <TablePager
            total={total}
            page={page}
            pageSize={pageSize}
            disabled={loading}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s)
              setPage(1)
            }}
          />
        </div>
      </Card>
    </PageContainer>
  )
}
