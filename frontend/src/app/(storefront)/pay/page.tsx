'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import QRCode from 'qrcode'
import { storefrontApi, extractError, extractBlobError } from '@/lib/api'

function PayInner() {
  const searchParams = useSearchParams()
  const orderNo = searchParams.get('order') || ''
  const router = useRouter()

  const [qrDataUrl, setQrDataUrl] = useState('')
  const [orderType, setOrderType] = useState('') // wechat / alipay
  const [amount, setAmount] = useState(0)
  const [status, setStatus] = useState('pending')
  const [licenseCode, setLicenseCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [latestVersion, setLatestVersion] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  const accessTokenRef = useRef('')
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false

    const stopPolling = () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current)
        pollTimer.current = null
      }
    }

    const startPolling = () => {
      if (pollTimer.current) return
      pollTimer.current = setInterval(async () => {
        try {
          const { data } = await storefrontApi.orderStatus(orderNo, accessTokenRef.current)
          if (cancelled) return
          setStatus(data.status)
          if (data.status === 'paid') {
            if (data.license_code) setLicenseCode(data.license_code)
            setLatestVersion(data.latest_version || '')
            stopPolling()
          } else if (data.status === 'expired' || data.status === 'closed') {
            stopPolling()
          }
        } catch {
          // 轮询失败静默忽略，下次重试
        }
      }, 2000)
    }

    ;(async () => {
      const cached = sessionStorage.getItem('pay_' + orderNo)
      let payUrl = ''
      let sceneToken = ''
      if (cached) {
        try {
          const obj = JSON.parse(cached)
          sceneToken = obj.access_token || ''
          payUrl = obj.qr_code || obj.pay_url || ''
        } catch {
          // ignore
        }
      }
      accessTokenRef.current = sceneToken
      if (payUrl) {
        try {
          const dataUrl = await QRCode.toDataURL(payUrl, { width: 220, margin: 1 })
          if (!cancelled) setQrDataUrl(dataUrl)
        } catch {
          // ignore
        }
      }
      if (!accessTokenRef.current) {
        setError('订单访问令牌缺失，请从购买流程重新进入或查看授权邮件')
        setLoading(false)
        return
      }

      try {
        const { data } = await storefrontApi.orderStatus(orderNo, accessTokenRef.current)
        if (cancelled) return
        setAmount(data.amount)
        setOrderType(data.payment_method)
        setStatus(data.status)
        if (data.status === 'paid' && data.license_code) {
          setLicenseCode(data.license_code)
          setLatestVersion(data.latest_version || '')
          setLoading(false)
          return
        }
      } catch (e) {
        if (cancelled) return
        setError(extractError(e))
        setLoading(false)
        return
      }

      setLoading(false)
      startPolling()
    })()

    return () => {
      cancelled = true
      stopPolling()
    }
  }, [orderNo])

  async function copyCode() {
    if (!licenseCode) return
    try {
      await navigator.clipboard.writeText(licenseCode)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = licenseCode
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function downloadRelease() {
    if (downloading) return
    setDownloading(true)
    setDownloadError('')
    try {
      const res = await storefrontApi.downloadRelease(orderNo, accessTokenRef.current)
      const disposition = (res.headers['content-disposition'] as string) || ''
      const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(disposition)
      const filename = match ? decodeURIComponent(match[1]) : `部署包-${latestVersion || 'latest'}`
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } catch (e) {
      setDownloadError(await extractBlobError(e))
    } finally {
      setDownloading(false)
    }
  }

  function methodLabel() {
    if (orderType === 'wechat') return '微信支付'
    if (orderType === 'alipay') return '支付宝'
    return '扫码支付'
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-12 md:py-16">
      {loading ? (
        <div className="text-center py-20 sf-muted">加载中...</div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-500 mb-4">{error}</p>
          <Link href="/" className="text-[color:var(--sf-mint)] hover:underline text-sm">
            返回首页
          </Link>
        </div>
      ) : status === 'paid' ? (
        <div className="text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-[color:var(--sf-mint-soft)] flex items-center justify-center mb-5">
            <svg
              className="h-8 w-8 text-[color:var(--sf-mint)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mb-2">支付成功</h1>
          <p className="text-sm sf-muted mb-6">授权码已生成并发送至您的邮箱</p>

          <div className="p-5 rounded-xl sf-panel mb-5">
            <div className="text-xs sf-muted mb-2">您的授权码</div>
            <div className="font-mono text-xl md:text-2xl font-semibold tracking-wider break-all">
              {licenseCode || '加载中...'}
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <button onClick={copyCode} className="px-5 py-2.5 rounded-md sf-btn sf-btn-primary text-sm">
              {copied ? '已复制' : '一键复制'}
            </button>
            <button
              onClick={() => router.push(`/success?order=${orderNo}`)}
              className="px-5 py-2.5 rounded-md sf-btn sf-btn-ghost text-sm"
            >
              查看详情
            </button>
          </div>

          {latestVersion && (
            <div className="mt-5 pt-5 border-t sf-line">
              <button
                onClick={downloadRelease}
                disabled={downloading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[color:var(--sf-ink)] hover:brightness-90 text-[color:var(--sf-bg)] text-sm font-medium transition disabled:opacity-60"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
                </svg>
                {downloading ? '准备下载...' : `下载最新版部署包（${latestVersion}）`}
              </button>
              {downloadError && <p className="mt-2 text-xs text-red-500">{downloadError}</p>}
            </div>
          )}
        </div>
      ) : status === 'pending' && qrDataUrl ? (
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight mb-1">{methodLabel()}扫码支付</h1>
          <p className="text-sm sf-muted mb-6">请使用{methodLabel()}扫描下方二维码完成支付</p>
          <div className="inline-block p-4 rounded-xl sf-panel">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="支付二维码" className="w-[220px] h-[220px]" />
          </div>
          <div className="mt-5 text-2xl font-semibold tracking-tight">¥{amount}</div>
          <p className="mt-3 text-xs sf-muted">支付完成后此页面将自动更新，请勿关闭</p>
        </div>
      ) : status === 'pending' ? (
        <div className="text-center py-10">
          <h1 className="text-xl font-semibold tracking-tight mb-2">等待支付确认</h1>
          <p className="text-sm sf-muted mb-6">订单金额 ¥{amount}，正在确认支付状态...</p>
          <div className="inline-block h-8 w-8 border-2 border-[color:var(--sf-mint)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="text-center py-10">
          <h1 className="text-xl font-semibold tracking-tight mb-2 text-red-500">订单已失效</h1>
          <p className="text-sm sf-muted mb-6">订单状态：{status}</p>
          <Link href="/" className="text-[color:var(--sf-mint)] hover:underline text-sm">
            重新购买
          </Link>
        </div>
      )}
    </div>
  )
}

export default function PayPage() {
  return (
    <Suspense fallback={null}>
      <PayInner />
    </Suspense>
  )
}
