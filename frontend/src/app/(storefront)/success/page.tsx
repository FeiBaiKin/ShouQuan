'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { storefrontApi, extractError, extractBlobError } from '@/lib/api'

function SuccessInner() {
  const searchParams = useSearchParams()
  const orderNo = searchParams.get('order') || ''

  const [loading, setLoading] = useState(true)
  const [licenseCode, setLicenseCode] = useState('')
  const [status, setStatus] = useState('pending')
  const [copied, setCopied] = useState(false)
  const [resendMsg, setResendMsg] = useState('')
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [latestVersion, setLatestVersion] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  const [accessToken, setAccessToken] = useState('')

  useEffect(() => {
    let token = ''
    try {
      const cached = sessionStorage.getItem('pay_' + orderNo)
      if (cached) token = JSON.parse(cached).access_token || ''
    } catch {
      // ignore
    }
    setAccessToken(token)
    if (!token) {
      setError('订单访问令牌缺失，请查看授权邮件或从购买流程重新进入')
      setLoading(false)
      return
    }
    storefrontApi
      .orderStatus(orderNo, token)
      .then(({ data }) => {
        setStatus(data.status)
        if (data.license_code) setLicenseCode(data.license_code)
        if (data.latest_version) setLatestVersion(data.latest_version)
      })
      .catch((e) => setError(extractError(e)))
      .finally(() => setLoading(false))
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
      const res = await storefrontApi.downloadRelease(orderNo, accessToken)
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

  async function resendEmail() {
    setResending(true)
    setResendMsg('')
    try {
      const { data } = await storefrontApi.resendEmail(orderNo, accessToken)
      setResendMsg((data as { message?: string })?.message || '邮件已发送')
    } catch (e) {
      setResendMsg(extractError(e))
    } finally {
      setResending(false)
    }
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
      ) : status === 'paid' && licenseCode ? (
        <>
          <div className="text-center mb-8">
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
            <h1 className="text-2xl font-semibold tracking-tight mb-2">购买成功</h1>
            <p className="text-sm sf-muted">授权码已发送至您的邮箱，请妥善保存</p>
          </div>

          {/* 授权码卡片 */}
          <div className="p-6 rounded-xl sf-panel mb-6">
            <div className="text-xs sf-muted mb-3">您的授权码</div>
            <div className="font-mono text-xl md:text-2xl font-semibold tracking-wider break-all mb-4">
              {licenseCode}
            </div>
            <button onClick={copyCode} className="w-full py-2.5 rounded-md sf-btn sf-btn-primary text-sm">
              {copied ? '已复制到剪贴板' : '一键复制授权码'}
            </button>
          </div>

          {/* 部署包下载 */}
          {latestVersion && (
            <div className="p-6 rounded-xl sf-panel mb-6">
              <div className="text-xs sf-muted mb-1">最新版部署包</div>
              <div className="text-sm font-medium mb-3">版本 {latestVersion}</div>
              <button
                onClick={downloadRelease}
                disabled={downloading}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-md bg-[color:var(--sf-ink)] hover:brightness-90 text-[color:var(--sf-bg)] text-sm font-medium transition disabled:opacity-60"
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
                {downloading ? '准备下载...' : '下载最新版部署包'}
              </button>
              {downloadError && <p className="mt-2 text-xs text-red-500">{downloadError}</p>}
            </div>
          )}

          {/* 激活指引 */}
          <div className="p-5 rounded-xl sf-panel mb-6">
            <h3 className="font-semibold mb-3 text-sm">激活步骤</h3>
            <ol className="space-y-2 text-sm sf-muted list-decimal list-inside">
              <li>登录您的程序管理后台</li>
              <li>找到「授权设置」或「系统设置」入口</li>
              <li>填入上方授权码并点击激活</li>
              <li>激活后将自动绑定当前域名并开始计算有效期</li>
            </ol>
          </div>

          {/* 重发邮件 */}
          <div className="text-center">
            {resendMsg && (
              <p
                className={`text-sm mb-2 ${
                  resendMsg.includes('失败') || resendMsg.includes('未配置')
                    ? 'text-red-500'
                    : 'text-[color:var(--sf-mint)]'
                }`}
              >
                {resendMsg}
              </p>
            )}
            <button
              onClick={resendEmail}
              disabled={resending}
              className="text-sm sf-muted hover:text-[color:var(--sf-mint)] transition-colors"
            >
              {resending ? '发送中...' : '重新发送授权码邮件'}
            </button>
          </div>
        </>
      ) : (
        <div className="text-center py-20">
          <p className="sf-muted mb-4">订单尚未支付或正在确认中</p>
          <Link href="/" className="text-[color:var(--sf-mint)] hover:underline text-sm">
            返回首页
          </Link>
        </div>
      )}
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessInner />
    </Suspense>
  )
}
