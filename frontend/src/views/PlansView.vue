<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  NButton,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  NSwitch,
  NTag,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { extractError, planApi, productApi } from '@/api'
import type { PricingPlan, Product, DurationType } from '@/types'

const message = useMessage()
const plans = ref<PricingPlan[]>([])
const products = ref<Product[]>([])
const loading = ref(true)

const showModal = ref(false)
const saving = ref(false)
const editing = ref<PricingPlan | null>(null)
const form = ref({
  product_id: null as number | null,
  name: '',
  price: 0,
  duration_type: 'yearly' as DurationType,
  duration_days: 365,
  features: '',
  remark: '',
  sort_order: 0,
  enabled: true,
})

const productOptions = computed(() =>
  products.value.map((p) => ({ label: p.name, value: p.id })),
)
const durationOptions = [
  { label: '年度（365 天）', value: 'yearly' },
  { label: '永久', value: 'permanent' },
  { label: '自定义天数', value: 'custom' },
]

async function load() {
  loading.value = true
  try {
    const [planResp, prodResp] = await Promise.all([planApi.list(), productApi.list()])
    plans.value = planResp.data
    products.value = prodResp.data
  } catch (err) {
    message.error(extractError(err))
  } finally {
    loading.value = false
  }
}
onMounted(load)

function openCreate() {
  editing.value = null
  form.value = {
    product_id: products.value[0]?.id ?? null,
    name: '',
    price: 0,
    duration_type: 'yearly',
    duration_days: 365,
    features: '',
    remark: '',
    sort_order: 0,
    enabled: true,
  }
  showModal.value = true
}

function openEdit(p: PricingPlan) {
  editing.value = p
  form.value = {
    product_id: p.product_id,
    name: p.name,
    price: p.price,
    duration_type: p.duration_type,
    duration_days: p.duration_days,
    features: p.features,
    remark: p.remark,
    sort_order: p.sort_order,
    enabled: p.enabled,
  }
  showModal.value = true
}

async function save() {
  if (!form.value.product_id) {
    message.warning('请选择产品')
    return
  }
  if (!form.value.name.trim()) {
    message.warning('请填写套餐名称')
    return
  }
  if (form.value.price <= 0) {
    message.warning('价格需大于 0')
    return
  }
  saving.value = true
  try {
    const payload = { ...form.value, product_id: form.value.product_id as number, duration_type: form.value.duration_type as DurationType }
    if (editing.value) {
      await planApi.update(editing.value.id, payload)
      message.success('已保存')
    } else {
      await planApi.create(payload)
      message.success('已创建')
    }
    showModal.value = false
    await load()
  } catch (err) {
    message.error(extractError(err))
  } finally {
    saving.value = false
  }
}

async function remove(p: PricingPlan) {
  try {
    await planApi.remove(p.id)
    message.success('已删除')
    await load()
  } catch (err) {
    message.error(extractError(err))
  }
}

function durationLabel(t: string, days: number): string {
  if (t === 'permanent') return '永久'
  if (t === 'yearly') return '365 天'
  return `${days} 天`
}

const columns = computed<DataTableColumns<PricingPlan>>(() => [
  { title: 'ID', key: 'id', width: 60 },
  { title: '产品', key: 'product_name', width: 140 },
  { title: '套餐名', key: 'name', width: 120 },
  {
    title: '价格',
    key: 'price',
    width: 100,
    render: (r) => `¥${r.price}`,
  },
  {
    title: '期限',
    key: 'duration',
    width: 110,
    render: (r) => durationLabel(r.duration_type, r.duration_days),
  },
  { title: '排序', key: 'sort_order', width: 70 },
  {
    title: '状态',
    key: 'enabled',
    width: 80,
    render: (r) =>
      r.enabled
        ? h(NTag, { type: 'success', size: 'small' }, () => '启用')
        : h(NTag, { type: 'default', size: 'small' }, () => '禁用'),
  },
  {
    title: '操作',
    key: 'actions',
    width: 140,
    render: (r) =>
      h(NSpace, { size: 4 }, () => [
        h(NButton, { size: 'small', text: true, onClick: () => openEdit(r) }, () => '编辑'),
        h(
          NPopconfirm,
          { onPositiveClick: () => remove(r) },
          {
            trigger: () => h(NButton, { size: 'small', text: true, type: 'error' }, () => '删除'),
            default: () => '确认删除该套餐？已购买的订单不受影响。',
          },
        ),
      ]),
  },
])

import { h } from 'vue'
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">套餐管理</h2>
        <p class="page-sub">为产品配置可购买的授权套餐</p>
      </div>
      <n-button type="primary" @click="openCreate">新建套餐</n-button>
    </div>

    <n-data-table
      :columns="columns"
      :data="plans"
      :loading="loading"
      :bordered="false"
      :row-key="(r: PricingPlan) => r.id"
    />

    <n-modal v-model:show="showModal" preset="card" :title="editing ? '编辑套餐' : '新建套餐'" style="width: 560px">
      <n-form label-placement="top">
        <n-form-item label="产品">
          <n-select v-model:value="form.product_id" :options="productOptions" :disabled="!!editing" placeholder="选择产品" />
        </n-form-item>
        <n-form-item label="套餐名称">
          <n-input v-model:value="form.name" placeholder="如 年付 / 永久 / 季付" />
        </n-form-item>
        <n-space :size="12">
          <n-form-item label="价格（元）">
            <n-input-number v-model:value="form.price" :min="0.01" :precision="2" style="width: 160px" />
          </n-form-item>
          <n-form-item label="排序">
            <n-input-number v-model:value="form.sort_order" :min="0" style="width: 120px" />
          </n-form-item>
        </n-space>
        <n-form-item label="期限类型">
          <n-select v-model:value="form.duration_type" :options="durationOptions" />
        </n-form-item>
        <n-form-item v-if="form.duration_type === 'custom'" label="天数">
          <n-input-number v-model:value="form.duration_days" :min="1" style="width: 160px" />
        </n-form-item>
        <n-form-item label="特性（JSON 数组，每行一条）">
          <n-input
            v-model:value="form.features"
            type="textarea"
            :rows="4"
            placeholder='["商业授权","一年更新","技术支持"]'
          />
        </n-form-item>
        <n-form-item label="备注">
          <n-input v-model:value="form.remark" type="textarea" :rows="2" />
        </n-form-item>
        <n-form-item label="启用">
          <n-switch v-model:value="form.enabled" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showModal = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="save">保存</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>
