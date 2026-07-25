export function formatTime(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDate(value: string | null | undefined): string {
  return formatTime(value).slice(0, 10)
}

export function formatSize(bytes: number): string {
  if (!bytes) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`
}

import type { LicenseStatus } from './types'

export const statusLabels: Record<LicenseStatus, string> = {
  unactivated: '未激活',
  active: '有效',
  expired: '已过期',
  revoked: '已吊销',
}

// 授权状态徽章配色（对应旧 naive-ui default/success/warning/error）
export const statusBadgeClass: Record<LicenseStatus, string> = {
  unactivated: 'bg-muted text-muted-foreground border-transparent',
  active: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent',
  expired: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent',
  revoked: 'bg-red-500/15 text-red-600 dark:text-red-400 border-transparent',
}

export const durationLabels: Record<string, string> = {
  yearly: '年度',
  permanent: '永久',
  custom: '自定义',
}

export const eventLabels: Record<string, string> = {
  create: '创建',
  activate: '激活',
  renew: '续期',
  rebind: '改绑',
  revoke: '吊销',
  restore: '恢复',
  reset: '重置',
}
