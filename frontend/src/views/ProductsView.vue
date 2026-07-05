<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  NButton,
  NCard,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPopconfirm,
  NSpace,
  NSpin,
  NTag,
  NText,
  useMessage,
} from 'naive-ui'
import { extractError, productApi } from '@/api'
import type { Product } from '@/types'
import { formatDate } from '@/utils/format'

const message = useMessage()
const products = ref<Product[]>([])
const loading = ref(true)

const showModal = ref(false)
const saving = ref(false)
const editing = ref<Product | null>(null)
const form = ref({ name: '', slug: '', remark: '' })

async function load() {
  loading.value = true
  try {
    products.value = (await productApi.list()).data
  } catch (err) {
    message.error(extractError(err))
  } finally {
    loading.value = false
  }
}
onMounted(load)

function openCreate() {
  editing.value = null
  form.value = { name: '', slug: '', remark: '' }
  showModal.value = true
}

function openEdit(p: Product) {
  editing.value = p
  form.value = { name: p.name, slug: p.slug, remark: p.remark }
  showModal.value = true
}

async function save() {
  if (!form.value.name.trim()) {
    message.warning('请填写产品名称')
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await productApi.update(editing.value.id, { name: form.value.name, remark: form.value.remark })
      message.success('已保存')
    } else {
      await productApi.create(form.value)
      message.success('产品已创建，公钥已生成')
    }
    showModal.value = false
    await load()
  } catch (err) {
    message.error(extractError(err))
  } finally {
    saving.value = false
  }
}

async function remove(p: Product) {
  try {
    await productApi.remove(p.id)
    message.success('已删除')
    await load()
  } catch (err) {
    message.error(extractError(err))
  }
}

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => message.success(`${label}已复制`),
    () => message.error('复制失败'),
  )
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">产品管理</h1>
        <p class="page-sub">每个产品持有独立的签名密钥对，公钥需嵌入接入方程序</p>
      </div>
      <n-button type="primary" @click="openCreate">新建产品</n-button>
    </div>

    <n-spin :show="loading">
      <n-empty
        v-if="!loading && products.length === 0"
        description="还没有产品"
        style="padding: 80px 0"
      >
        <template #extra>
          <n-button type="primary" @click="openCreate">创建第一个产品</n-button>
        </template>
      </n-empty>

      <n-space v-else vertical :size="12">
        <n-card v-for="p in products" :key="p.id" size="small">
          <div class="product-row">
            <div class="product-main">
              <div class="product-title">
                <span class="product-name">{{ p.name }}</span>
                <n-tag size="small" :bordered="false"><span class="mono">{{ p.slug }}</span></n-tag>
                <n-tag v-if="p.latest_version" size="small" type="success" :bordered="false">
                  <span class="mono">v{{ p.latest_version }}</span>
                </n-tag>
              </div>
              <n-text depth="3" style="font-size: 13px">
                授权 {{ p.license_count }} 个 · 版本 {{ p.release_count }} 个 · 创建于 {{ formatDate(p.created_at) }}
                <template v-if="p.remark"> · {{ p.remark }}</template>
              </n-text>
              <div class="pubkey">
                <n-text depth="3" style="font-size: 12px">公钥</n-text>
                <code class="mono pubkey-value">{{ p.public_key }}</code>
                <n-button text size="tiny" type="primary" @click="copy(p.public_key, '公钥')">复制</n-button>
              </div>
            </div>
            <n-space :size="8">
              <n-button size="small" @click="openEdit(p)">编辑</n-button>
              <n-popconfirm @positive-click="remove(p)">
                <template #trigger>
                  <n-button size="small" quaternary type="error">删除</n-button>
                </template>
                确定删除产品「{{ p.name }}」？仅当其下无授权和版本时可删除。
              </n-popconfirm>
            </n-space>
          </div>
        </n-card>
      </n-space>
    </n-spin>

    <n-modal
      v-model:show="showModal"
      preset="card"
      :title="editing ? '编辑产品' : '新建产品'"
      style="width: 460px"
    >
      <n-form label-placement="top">
        <n-form-item label="产品名称" required>
          <n-input v-model:value="form.name" placeholder="如：XZJI 资源站" />
        </n-form-item>
        <n-form-item label="产品标识（slug）" required>
          <n-input
            v-model:value="form.slug"
            placeholder="如：xzji（创建后不可修改）"
            :disabled="!!editing"
          />
        </n-form-item>
        <n-form-item label="备注">
          <n-input v-model:value="form.remark" type="textarea" :rows="2" placeholder="" />
        </n-form-item>
        <n-space justify="end">
          <n-button @click="showModal = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="save">
            {{ editing ? '保存' : '创建' }}
          </n-button>
        </n-space>
      </n-form>
    </n-modal>
  </div>
</template>

<style scoped>
.product-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.product-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.product-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.product-name {
  font-size: 15px;
  font-weight: 600;
}

.pubkey {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.pubkey-value {
  font-size: 12px;
  opacity: 0.75;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 420px;
}
</style>
