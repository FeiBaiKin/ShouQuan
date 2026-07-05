import type { LicenseStatus } from '@/types'

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

export const statusLabels: Record<LicenseStatus, string> = {
  unactivated: '未激活',
  active: '有效',
  expired: '已过期',
  revoked: '已吊销',
}

export const statusTypes: Record<LicenseStatus, 'default' | 'success' | 'warning' | 'error'> = {
  unactivated: 'default',
  active: 'success',
  expired: 'warning',
  revoked: 'error',
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
