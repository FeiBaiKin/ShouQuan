'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { storefrontApi, extractError } from '@/lib/api'
import { parseFeatures, type PricingPlan, type PaymentMethod } from '@/lib/types'

function BuyInner() {
  const searchParams = useSearchParams()
  const planId = Number(searchParams.get('plan'))
  const router = useRouter()

  const [plan, setPlan] = useState<PricingPlan | null>(null)
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [email, setEmail] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([storefrontApi.products(), storefrontApi.paymentMethods()])
      .then(([prodResp, methodResp]) => {
        setMethods(methodResp.data.methods)
        if (methodResp.data.methods.length) setPaymentMethod(methodResp.data.methods[0].name)
        let found: PricingPlan | null = null
        for (const p of prodResp.data) {
          const pl = p.plans.find((x) => x.id === planId)
          if (pl) {
            found = { ...pl, product: p }
            break
          }
        }
        if (found) setPlan(found)
        else setError('套餐不存在或已下架')
      })
      .catch((e) => setError(extractError(e)))
      .finally(() => setLoading(false))
  }, [planId])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!plan) return
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('请填写有效的邮箱地址')
      return
    }
    if (!paymentMethod) {
      setError('请选择支付方式')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const { data } = await storefrontApi.createOrder({
        plan_id: plan.id,
        email,
        customer_name: customerName,
        payment_method: paymentMethod,
      })
      sessionStorage.setItem(
        'pay_' + data.order_no,
        JSON.stringify({
          access_token: data.access_token,
          qr_code: data.qr_code,
          pay_url: data.pay_url,
          scene: data.scene,
          type: data.type,
          expires_at: data.expires_at,
        }),
      )
      // 支付宝 page / wap：跳转支付宝收银台
      if (data.type === 'alipay' && (data.scene === 'page' || data.scene === 'wap')) {
        window.location.href = data.pay_url
        return
      }
      // 其余（微信 native / 支付宝 precreate）：跳支付页展示二维码
      router.push(`/pay?order=${data.order_no}`)
    } catch (e) {
      setError(extractError(e))
    } finally {
      setSubmitting(false)
    }
  }

  function durationLabel(t: string, days: number) {
    if (t === 'permanent') return '永久授权'
    if (t === 'yearly') return '一年授权'
    return `${days} 天授权`
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 md:py-16">
      {loading ? (
        <div className="text-center py-20 sf-muted">加载中...</div>
      ) : error && !plan ? (
        <div className="text-center py-20">
          <p className="text-red-500 mb-4">{error}</p>
          <Link href="/" className="text-[color:var(--sf-mint)] hover:underline text-sm">
            返回首页
          </Link>
        </div>
      ) : plan ? (
        <>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-2">确认订单</h1>
          <p className="text-sm sf-muted mb-8">请核对套餐信息并填写接收邮箱</p>

          {/* 套餐概要 */}
          <div className="p-5 rounded-xl sf-panel mb-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm sf-muted">{plan.product?.name || '产品'}</div>
                <div className="mt-1 font-semibold text-lg">{plan.name}</div>
                <div className="mt-1 text-sm sf-muted">
                  {durationLabel(plan.duration_type, plan.duration_days)}
                </div>
              </div>
              <div className="text-2xl font-semibold tracking-tight">¥{plan.price}</div>
            </div>
            {parseFeatures(plan.features).length > 0 && (
              <ul className="mt-4 pt-4 border-t sf-line space-y-1.5 text-sm sf-muted">
                {parseFeatures(plan.features).map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-[color:var(--sf-mint)] shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 表单 */}
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                接收邮箱 <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-md border sf-line bg-[color:var(--sf-panel)] text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--sf-mint)]/40 focus:border-[color:var(--sf-mint)]"
              />
              <p className="mt-1.5 text-xs sf-muted">授权码将发送至此邮箱，请确保地址正确。</p>
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1.5">
                称呼（可选）
              </label>
              <input
                id="name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                type="text"
                placeholder="您的姓名或站点名"
                className="w-full px-3.5 py-2.5 rounded-md border sf-line bg-[color:var(--sf-panel)] text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--sf-mint)]/40 focus:border-[color:var(--sf-mint)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">支付方式</label>
              <div className="grid grid-cols-2 gap-3">
                {methods.map((m) => (
                  <button
                    key={m.name}
                    type="button"
                    onClick={() => setPaymentMethod(m.name)}
                    className={`px-4 py-3 rounded-md border text-sm font-medium transition-colors text-left ${
                      paymentMethod === m.name
                        ? 'border-[color:var(--sf-mint)] bg-[color:var(--sf-mint-soft)] text-[color:var(--sf-mint)]'
                        : 'sf-line hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {!methods.length && (
                <p className="mt-2 text-xs text-red-500">暂无可用支付方式，请联系管理员。</p>
              )}
            </div>

            {error && <div className="text-sm text-red-500">{error}</div>}

            <button
              type="submit"
              disabled={submitting || !methods.length}
              className="w-full py-3 rounded-md sf-btn sf-btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {submitting ? '创建订单中...' : `支付 ¥${plan.price}`}
            </button>
          </form>
        </>
      ) : null}
    </div>
  )
}

export default function BuyPage() {
  return (
    <Suspense fallback={null}>
      <BuyInner />
    </Suspense>
  )
}
