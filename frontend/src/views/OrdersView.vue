<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import {
  NButton,
  NDataTable,
  NInput,
  NSelect,
  NSpace,
  NTag,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { extractError, orderApi, productApi } from '@/api'
import { formatTime } from '@/utils/format'
import type { PurchaseOrder, Product } from '@/types'

const message = useMessage()
const orders = ref<PurchaseOrder[]>([])
const products = ref<Product[]>([])
const loading = ref(true)
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

const filters = ref({
  status: '' as string,
  product_id: '' as string,
  method: '' as string,
  q: '',
})

const statusOptions = [
  { label: '全部', value: '' },
  { label: '待支付', value: 'pending' },
  { label: '已支付', value: 'paid' },
  { label: '已过期', value: 'expired' },
  { label: '已关闭', value: 'closed' },
]
const methodOptions = [
  { label: '全部', value: '' },
  { label: '支付宝', value: 'alipay' },
  { label: '微信', value: 'wechat' },
]
const productOptions = computed(() => [
  { label: '全部', value: '' },
  ...products.value.map((p) => ({ label: p.name, value: String(p.id) })),
])

const statusMap: Record<string, { label: string; type: 'default' | 'success' | 'warning' | 'error' }> = {
  pending: { label: '待支付', type: 'warning' },
  paid: { label: '已支付', type: 'success' },
  expired: { label: '已过期', type: 'default' },
  closed: { label: '已关闭', type: 'default' },
}
const methodMap: Record<string, string> = { alipay: '支付宝', wechat: '微信' }

async function load() {
  loading.value = true
  try {
    const { data } = await orderApi.list({
      status: filters.value.status || undefined,
      product_id: filters.value.product_id ? Number(filters.value.product_id) : undefined,
      method: filters.value.method || undefined,
      q: filters.value.q || undefined,
      page: page.value,
      page_size: pageSize.value,
    })
    orders.value = data.items
    total.value = data.total
  } catch (err) {
    message.error(extractError(err))
  } finally {
    loading.value = false
  }
}

async function loadProducts() {
  try {
    products.value = (await productApi.list()).data
  } catch {
    // ignore
  }
}

onMounted(async () => {
  await loadProducts()
  await load()
})

function onFilter() {
  page.value = 1
  load()
}

function copyCode(code: string) {
  navigator.clipboard.writeText(code).then(() => message.success('已复制'))
}

const columns = computed<DataTableColumns<PurchaseOrder>>(() => [
  { title: '订单号', key: 'order_no', width: 200, ellipsis: { tooltip: true } },
  { title: '产品', key: 'product_name', width: 120 },
  { title: '套餐', key: 'plan_name', width: 100 },
  { title: '邮箱', key: 'email', width: 180, ellipsis: { tooltip: true } },
  {
    title: '金额',
    key: 'amount',
    width: 90,
    render: (r) => `¥${r.amount}`,
  },
  {
    title: '支付方式',
    key: 'payment_method',
    width: 90,
    render: (r) => methodMap[r.payment_method] || r.payment_method || '-',
  },
  {
    title: '状态',
    key: 'status',
    width: 90,
    render: (r) => {
      const s = statusMap[r.status] || { label: r.status, type: 'default' as const }
      return h(NTag, { type: s.type, size: 'small' }, () => s.label)
    },
  },
  {
    title: '授权码',
    key: 'license_code',
    width: 200,
    ellipsis: { tooltip: true },
    render: (r) =>
      r.license_code
        ? h(NSpace, { size: 4, align: 'center' }, () => [
            h('span', { class: 'mono' }, r.license_code!),
            h(NButton, { size: 'tiny', text: true, type: 'primary', onClick: () => copyCode(r.license_code!) }, () => '复制'),
          ])
        : '-',
  },
  {
    title: '创建时间',
    key: 'created_at',
    width: 150,
    render: (r) => formatTime(r.created_at),
  },
  {
    title: '支付时间',
    key: 'paid_at',
    width: 150,
    render: (r) => (r.paid_at ? formatTime(r.paid_at) : '-'),
  },
])
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">订单管理</h2>
        <p class="page-sub">用户购买授权的订单记录</p>
      </div>
    </div>

    <n-space :size="8" style="margin-bottom: 16px" align="center">
      <n-select
        v-model:value="filters.status"
        :options="statusOptions"
        placeholder="状态"
        style="width: 130px"
        @update:value="onFilter"
      />
      <n-select
        v-model:value="filters.product_id"
        :options="productOptions"
        placeholder="产品"
        style="width: 150px"
        @update:value="onFilter"
      />
      <n-select
        v-model:value="filters.method"
        :options="methodOptions"
        placeholder="支付方式"
        style="width: 130px"
        @update:value="onFilter"
      />
      <n-input
        v-model:value="filters.q"
        placeholder="订单号 / 邮箱 / 流水号"
        style="width: 240px"
        clearable
        @keyup.enter="onFilter"
        @clear="onFilter"
      />
      <n-button type="primary" @click="onFilter">查询</n-button>
    </n-space>

    <n-data-table
      :columns="columns"
      :data="orders"
      :loading="loading"
      :bordered="false"
      :row-key="(r: PurchaseOrder) => r.id"
      :pagination="{
        page,
        pageSize,
        itemCount: total,
        showSizePicker: true,
        pageSizes: [20, 50, 100],
        onChange: (p: number) => { page = p; load() },
        onUpdatePageSize: (s: number) => { pageSize = s; page = 1; load() },
      }"
      remote
    />
  </div>
</template>
