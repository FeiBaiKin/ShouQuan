<script setup lang="ts">
// 支付宝 page 支付同步返回的中转页，重定向到 pay 页轮询状态
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

onMounted(() => {
  const orderNo = route.query.order as string
  if (orderNo) {
    router.replace({ name: 'pay', params: { orderNo } })
  } else {
    router.replace({ name: 'home' })
  }
})
</script>

<template>
  <div class="min-h-[60dvh] flex items-center justify-center text-zinc-500 text-sm">
    正在跳转...
  </div>
</template>
