'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const DEFAULT_SIZES = [20, 50, 100]

/** 后台统一分页器：总数 + 每页条数 + 页码 + 前后翻页。 */
export function TablePager({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sizes = DEFAULT_SIZES,
  disabled = false,
}: {
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  sizes?: number[]
  disabled?: boolean
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 text-sm text-muted-foreground">
      <span>共 {total} 条</span>
      <Select
        value={String(pageSize)}
        onValueChange={(v) => onPageSizeChange(Number(v))}
        disabled={disabled}
      >
        <SelectTrigger size="sm" className="w-[104px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sizes.map((s) => (
            <SelectItem key={s} value={String(s)}>
              {s} 条/页
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="tabular-nums">
        {page} / {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          aria-label="上一页"
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          aria-label="下一页"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
