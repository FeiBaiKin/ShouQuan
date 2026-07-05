<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import {
  NButton,
  NCard,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NProgress,
  NSelect,
  NSpace,
  NSwitch,
  NTag,
  NText,
  NUpload,
  NUploadDragger,
  useDialog,
  useMessage,
  type DataTableColumns,
  type UploadFileInfo,
} from 'naive-ui'
import { extractError, productApi, releaseApi } from '@/api'
import type { Product, Release } from '@/types'
import { formatSize, formatTime } from '@/utils/format'

const message = useMessage()
const dialog = useDialog()

const products = ref<Product[]>([])
const releases = ref<Release[]>([])
const loading = ref(false)
const filterProduct = ref<number | null>(null)

const productOptions = computed(() =>
  products.value.map((p) => ({ label: p.name, value: p.id })),
)

async function load() {
  loading.value = true
  try {
    releases.value = (await releaseApi.list(filterProduct.value)).data
  } catch (err) {
    message.error(extractError(err))
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    products.value = (await productApi.list()).data
  } catch (err) {
    message.error(extractError(err))
  }
  await load()
})

const columns = computed<DataTableColumns<Release>>(() => [
  {
    title: '产品',
    key: 'product',
    width: 120,
    render: (r) => r.product?.name ?? '-',
  },
  {
    title: '版本',
    key: 'version',
    width: 110,
    render: (r) => h('span', { class: 'mono', style: 'font-weight:600' }, r.version),
  },
  {
    title: '状态',
    key: 'published',
    width: 90,
    render: (r) =>
      h(
        NTag,
        { size: 'small', type: r.published ? 'success' : 'default', bordered: false },
        { default: () => (r.published ? '已发布' : '未发布') },
      ),
  },
  {
    title: '强制更新',
    key: 'forced',
    width: 90,
    render: (r) => (r.forced ? h(NTag, { size: 'small', type: 'warning', bordered: false }, { default: () => '强制' }) : '-'),
  },
  { title: '大小', key: 'file_size', width: 90, render: (r) => h('span', { class: 'mono' }, formatSize(r.file_size)) },
  {
    title: 'SHA256',
    key: 'sha256',
    width: 150,
    render: (r) =>
      h(
        'span',
        {
          class: 'mono',
          style: 'cursor:pointer;font-size:12px;opacity:.75',
          title: `${r.sha256}（点击复制）`,
          onClick: () => copySha(r.sha256),
        },
        r.sha256 ? r.sha256.slice(0, 16) + '…' : '-',
      ),
  },
  { title: '下载', key: 'downloads', width: 70, render: (r) => h('span', { class: 'mono' }, String(r.downloads)) },
  { title: '更新日志', key: 'changelog', ellipsis: { tooltip: true }, render: (r) => r.changelog || '-' },
  { title: '上传时间', key: 'created_at', width: 140, render: (r) => h(NText, { depth: 3 }, { default: () => formatTime(r.created_at) }) },
  {
    title: '操作',
    key: 'actions',
    width: 200,
    render: (r) =>
      h(NSpace, { size: 4 }, {
        default: () => [
          r.published
            ? h(NButton, { size: 'tiny', onClick: () => togglePublish(r, false) }, { default: () => '撤回' })
            : h(NButton, { size: 'tiny', type: 'primary', onClick: () => togglePublish(r, true) }, { default: () => '发布' }),
          h(NButton, { size: 'tiny', onClick: () => openEdit(r) }, { default: () => '编辑' }),
          h(NButton, { size: 'tiny', quaternary: true, type: 'error', onClick: () => remove(r) }, { default: () => '删除' }),
        ],
      }),
  },
])

function copySha(sha: string) {
  navigator.clipboard.writeText(sha).then(
    () => message.success('SHA256 已复制'),
    () => message.error('复制失败'),
  )
}

async function togglePublish(r: Release, publish: boolean) {
  if (publish) {
    dialog.info({
      title: '发布版本',
      content: `发布后所有有效授权站点心跳时将收到 ${r.version} 的更新提示。确定发布？`,
      positiveText: '发布',
      negativeText: '取消',
      onPositiveClick: async () => {
        try {
          await releaseApi.publish(r.id)
          message.success('已发布')
          await load()
        } catch (err) {
          message.error(extractError(err))
        }
      },
    })
  } else {
    try {
      await releaseApi.unpublish(r.id)
      message.success('已撤回，客户端将不再收到该版本')
      await load()
    } catch (err) {
      message.error(extractError(err))
    }
  }
}

function remove(r: Release) {
  dialog.error({
    title: '删除版本',
    content: `将删除版本记录及服务器上的更新包文件。确定删除 ${r.version}？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await releaseApi.remove(r.id)
        message.success('已删除')
        await load()
      } catch (err) {
        message.error(extractError(err))
      }
    },
  })
}

// ---- 上传 ----
const showUpload = ref(false)
const uploading = ref(false)
const uploadPercent = ref(0)
const uploadForm = reactive({
  product_id: null as number | null,
  version: '',
  changelog: '',
  forced: false,
})
const uploadFile = ref<File | null>(null)

function onFileChange(options: { fileList: UploadFileInfo[] }) {
  uploadFile.value = options.fileList[0]?.file ?? null
}

function openUpload() {
  uploadForm.product_id = filterProduct.value
  uploadForm.version = ''
  uploadForm.changelog = ''
  uploadForm.forced = false
  uploadFile.value = null
  uploadPercent.value = 0
  showUpload.value = true
}

async function submitUpload() {
  if (!uploadForm.product_id || !uploadForm.version.trim() || !uploadFile.value) {
    message.warning('请选择产品、填写版本号并选择更新包文件')
    return
  }
  uploading.value = true
  uploadPercent.value = 0
  try {
    const form = new FormData()
    form.append('product_id', String(uploadForm.product_id))
    form.append('version', uploadForm.version.trim())
    form.append('changelog', uploadForm.changelog)
    form.append('forced', uploadForm.forced ? '1' : '0')
    form.append('file', uploadFile.value)
    await releaseApi.upload(form, (p) => (uploadPercent.value = p))
    message.success('上传成功（默认未发布，确认无误后点「发布」）')
    showUpload.value = false
    await load()
  } catch (err) {
    message.error(extractError(err))
  } finally {
    uploading.value = false
  }
}

// ---- 编辑 ----
const showEdit = ref(false)
const editTarget = ref<Release | null>(null)
const editForm = reactive({ changelog: '', forced: false })
const editBusy = ref(false)

function openEdit(r: Release) {
  editTarget.value = r
  editForm.changelog = r.changelog
  editForm.forced = r.forced
  showEdit.value = true
}

async function submitEdit() {
  if (!editTarget.value) return
  editBusy.value = true
  try {
    await releaseApi.update(editTarget.value.id, editForm)
    message.success('已保存')
    showEdit.value = false
    await load()
  } catch (err) {
    message.error(extractError(err))
  } finally {
    editBusy.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">版本管理</h1>
        <p class="page-sub">上传更新包并发布，客户站点通过心跳感知新版本</p>
      </div>
      <n-space>
        <n-select
          v-model:value="filterProduct"
          :options="productOptions"
          placeholder="全部产品"
          clearable
          style="width: 160px"
          @update:value="load"
        />
        <n-button type="primary" @click="openUpload">上传新版本</n-button>
      </n-space>
    </div>

    <n-card size="small">
      <n-data-table
        :columns="columns"
        :data="releases"
        :loading="loading"
        :bordered="false"
        size="small"
        :row-key="(r: Release) => r.id"
        :scroll-x="1300"
      />
    </n-card>

    <!-- 上传 -->
    <n-modal v-model:show="showUpload" preset="card" title="上传新版本" style="width: 520px" :mask-closable="!uploading">
      <n-form label-placement="top">
        <n-form-item label="产品" required>
          <n-select v-model:value="uploadForm.product_id" :options="productOptions" placeholder="选择产品" :disabled="uploading" />
        </n-form-item>
        <n-form-item label="版本号" required>
          <n-input v-model:value="uploadForm.version" placeholder="如：1.2.0" class="mono" :disabled="uploading" />
        </n-form-item>
        <n-form-item label="更新日志">
          <n-input
            v-model:value="uploadForm.changelog"
            type="textarea"
            :rows="4"
            placeholder="本次更新内容，将展示给客户站点管理员"
            :disabled="uploading"
          />
        </n-form-item>
        <n-form-item label="强制更新">
          <n-space align="center">
            <n-switch v-model:value="uploadForm.forced" :disabled="uploading" />
            <n-text depth="3" style="font-size: 12px">开启后客户端应强制升级（由接入方实现具体策略）</n-text>
          </n-space>
        </n-form-item>
        <n-form-item label="更新包文件" required>
          <n-upload
            :max="1"
            :default-upload="false"
            :disabled="uploading"
            @change="onFileChange"
          >
            <n-upload-dragger>
              <n-text depth="3">点击或拖拽更新包到此处（如 tar.gz / zip）</n-text>
            </n-upload-dragger>
          </n-upload>
        </n-form-item>
        <n-progress
          v-if="uploading"
          type="line"
          :percentage="uploadPercent"
          indicator-placement="inside"
          style="margin-bottom: 12px"
        />
        <n-space justify="end">
          <n-button :disabled="uploading" @click="showUpload = false">取消</n-button>
          <n-button type="primary" :loading="uploading" @click="submitUpload">上传</n-button>
        </n-space>
      </n-form>
    </n-modal>

    <!-- 编辑 -->
    <n-modal v-model:show="showEdit" preset="card" :title="`编辑版本 ${editTarget?.version ?? ''}`" style="width: 480px">
      <n-form label-placement="top">
        <n-form-item label="更新日志">
          <n-input v-model:value="editForm.changelog" type="textarea" :rows="4" />
        </n-form-item>
        <n-form-item label="强制更新">
          <n-switch v-model:value="editForm.forced" />
        </n-form-item>
        <n-space justify="end">
          <n-button @click="showEdit = false">取消</n-button>
          <n-button type="primary" :loading="editBusy" @click="submitEdit">保存</n-button>
        </n-space>
      </n-form>
    </n-modal>
  </div>
</template>
