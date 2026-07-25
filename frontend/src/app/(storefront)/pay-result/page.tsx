'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// 支付宝 page 支付同步返回的中转页，重定向到 pay 页轮询状态
function PayResultInner() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const orderNo = searchParams.get('order')
    if (orderNo) {
      router.replace(`/pay?order=${orderNo}`)
    } else {
      router.replace('/')
    }
  }, [searchParams, router])

  return (
    <div className="min-h-[60dvh] flex items-center justify-center sf-muted text-sm">正在跳转...</div>
  )
}

export default function PayResultPage() {
  return (
    <Suspense fallback={null}>
      <PayResultInner />
    </Suspense>
  )
}
