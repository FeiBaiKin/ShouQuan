'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { dashboardApi, extractError } from '@/lib/api'
import type { DashboardData } from '@/lib/types'
import { eventLabels, formatDate, formatTime } from '@/lib/format'
import { PageContainer, PageHeader } from '@/components/admin/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

const STATS = [
  { key: 'license_total', label: '授权总数' },
  { key: 'license_active', label: '有效授权' },
  { key: 'sites_active_24h', label: '活跃站点（24h 有心跳）' },
  { key: 'license_expiring', label: '30 天内到期' },
  { key: 'license_unactivated', label: '未激活' },
  { key: 'license_revoked', label: '已吊销' },
] as const

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardApi
      .get()
      .then(({ data }) => setData(data))
      .catch((e) => toast.error(extractError(e)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <PageContainer>
      <PageHeader title="仪表盘" sub="授权与更新总览" />

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STATS.map((s) => (
            <Skeleton key={s.key} className="h-[86px] rounded-xl" />
          ))}
        </div>
      ) : data ? (
        <div className="space-y-3">
          {/* 统计卡 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {STATS.map((s) => (
              <Card key={s.key} className="gap-0 p-4">
                <div className="truncate text-xs text-muted-foreground">{s.label}</div>
                <div className="mono mt-1.5 text-[26px] font-semibold leading-none">
                  {data[s.key]}
                </div>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* 产品概况 */}
            <Card className="p-4">
              <div className="mb-3 text-sm font-medium">产品概况</div>
              {data.products.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>产品</TableHead>
                      <TableHead>标识</TableHead>
                      <TableHead>授权数</TableHead>
                      <TableHead>有效</TableHead>
                      <TableHead>最新版本</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.products.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.name}</TableCell>
                        <TableCell className="mono">{p.slug}</TableCell>
                        <TableCell className="mono">{p.license_count}</TableCell>
                        <TableCell className="mono">{p.active_count}</TableCell>
                        <TableCell className="mono">{p.latest_version || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  还没有产品，先到
                  <Link href="/admin/products" className="mx-1 text-emerald-600 hover:underline">
                    产品管理
                  </Link>
                  创建一个
                </div>
              )}
            </Card>

            {/* 即将到期 */}
            <Card className="p-4">
              <div className="mb-3 text-sm font-medium">即将到期（30 天内）</div>
              {data.expiring_list.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>授权码</TableHead>
                      <TableHead>客户</TableHead>
                      <TableHead>域名</TableHead>
                      <TableHead>到期日</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.expiring_list.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="mono">{l.code}</TableCell>
                        <TableCell>{l.customer_name || '-'}</TableCell>
                        <TableCell>{l.domain || '-'}</TableCell>
                        <TableCell>
                          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            {formatDate(l.expires_at)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  没有即将到期的授权
                </div>
              )}
            </Card>
          </div>

          {/* 最近动态 */}
          <Card className="p-4">
            <div className="mb-3 text-sm font-medium">最近动态</div>
            {data.recent_events.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[90px]">操作</TableHead>
                    <TableHead className="w-[220px]">授权码</TableHead>
                    <TableHead>详情</TableHead>
                    <TableHead className="w-[150px]">时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recent_events.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <Badge variant="secondary">{eventLabels[e.type] ?? e.type}</Badge>
                      </TableCell>
                      <TableCell className="mono">{e.code || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{e.detail}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatTime(e.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">暂无动态</div>
            )}
          </Card>
        </div>
      ) : null}
    </PageContainer>
  )
}
