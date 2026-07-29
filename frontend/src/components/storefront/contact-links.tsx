'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Mail, MessageCircle, MessageSquare, QrCode, Users } from 'lucide-react'
import type { SiteContact } from '@/lib/types'

interface Channel {
  key: string
  label: string
  value?: string
  qr?: string
  icon: typeof Mail
  mailto?: boolean
}

/** 组装展示渠道：号码与二维码都为空的项不展示（后台留空即隐藏）。 */
function buildChannels(contact: SiteContact): Channel[] {
  const channels: Channel[] = [
    { key: 'qq', label: 'QQ', value: contact.qq, qr: contact.qq_qr, icon: MessageCircle },
    { key: 'qq_group', label: 'QQ群', value: contact.qq_group, qr: contact.qq_group_qr, icon: Users },
    { key: 'wechat', label: '微信', value: contact.wechat, qr: contact.wechat_qr, icon: MessageSquare },
    { key: 'email', label: '邮箱', value: contact.email, icon: Mail, mailto: true },
  ]
  return channels.filter((ch) => ch.value?.trim() || ch.qr?.trim())
}

/**
 * 页脚联系方式：有二维码的渠道点击弹出二维码，无二维码的点击复制号码，邮箱走 mailto。
 */
export function ContactLinks({ contact }: { contact: SiteContact }) {
  const channels = buildChannels(contact)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const copyTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!openKey) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpenKey(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenKey(null)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [openKey])

  useEffect(
    () => () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current)
    },
    [],
  )

  if (!channels.length) return null

  const copyValue = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      return
    }
    setCopiedKey(key)
    if (copyTimer.current) window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopiedKey(null), 1600)
  }

  const itemClass =
    'inline-flex items-center gap-1.5 hover:text-[color:var(--sf-ink)] transition-colors'

  return (
    <div ref={wrapRef} className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <span className="font-medium text-[color:var(--sf-ink)]">联系我们</span>
      {channels.map((ch) => {
        const Icon = ch.icon
        const value = ch.value?.trim() ?? ''
        const copied = copiedKey === ch.key

        if (ch.mailto && value) {
          return (
            <a key={ch.key} href={`mailto:${value}`} className={itemClass}>
              <Icon size={13} />
              <span>{value}</span>
            </a>
          )
        }

        if (ch.qr) {
          return (
            <span key={ch.key} className="relative inline-flex">
              <button
                type="button"
                onClick={() => setOpenKey((k) => (k === ch.key ? null : ch.key))}
                className={itemClass}
                aria-expanded={openKey === ch.key}
                aria-label={`查看${ch.label}二维码`}
              >
                <Icon size={13} />
                <span>{value ? `${ch.label} ${value}` : ch.label}</span>
                <QrCode size={12} className="opacity-70" />
              </button>
              {openKey === ch.key && (
                <div className="absolute bottom-full left-0 z-50 mb-2.5 rounded-xl border sf-line bg-[color:var(--sf-panel)] p-3 shadow-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ch.qr}
                    alt={`${ch.label}二维码`}
                    className="h-36 w-36 rounded-md bg-white object-contain"
                  />
                  {value && (
                    <button
                      type="button"
                      onClick={() => copyValue(ch.key, value)}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 text-[12px] sf-muted hover:text-[color:var(--sf-ink)] transition-colors"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? '已复制' : value}
                    </button>
                  )}
                </div>
              )}
            </span>
          )
        }

        return (
          <button
            key={ch.key}
            type="button"
            onClick={() => copyValue(ch.key, value)}
            className={itemClass}
            aria-label={`复制${ch.label}`}
          >
            {copied ? <Check size={13} /> : <Icon size={13} />}
            <span>{copied ? '已复制' : `${ch.label} ${value}`}</span>
          </button>
        )
      })}
    </div>
  )
}
