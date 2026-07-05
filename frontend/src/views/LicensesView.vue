<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import {
  NButton,
  NCard,
  NDataTable,
  NDrawer,
  NDrawerContent,
  NDescriptions,
  NDescriptionsItem,
  NDropdown,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NPagination,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSpace,
  NTabs,
  NTabPane,
  NTag,
  NText,
  NTimeline,
  NTimelineItem,
  NEmpty,
  useDialog,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { extractError, licenseApi, productApi } from '@/api'
import type { HeartbeatLog, License, LicenseEvent, Product } from '@/types'
import {
  durationLabels,
  eventLabels,
  formatDate,
  formatTime,
  statusLabels,
  statusTypes,
} from '@/utils/format'

const message = useMessage()
const dialog = useDialog()

// ---- 列表状态 ----
const products = ref<Product[]>([])
const items = ref<License[]>([])
const total = ref(0)
const loading = ref(false)
const query = reactive({
  product_id: null as number | null,
  status: null as string | null,
  q: '',
  page: 1,
  page_size: 20,
})

const productOptions = computed(() =>
  products.value.map((p) => ({ label: p.name, value: p.id })),
)

const statusOptions = [
  { label: '有效', value: 'active' },
  { label: '未激活', value: 'unactivated' },
  { label: '已过期', value: 'expired' },
  { label: '30 天内到期', value: 'expiring' },
  { label: '已吊销', value: 'revoked' },
]

async function load() {
  loading.value = true
  try {
    const { data } = await licenseApi.list(query)
    items.value = data.items
    total.value = data.total
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

function search() {
  query.page = 1
  load()
}

// ---- 表格 ----
function statusTag(l: License) {
  return h(
    NTag,
    { size: 'small', type: statusTypes[l.effective_status], bordered: false },
    { default: () => statusLabels[l.effective_status] },
  )
}

function expiryText(l: License) {
  if (l.status === 'unactivated') {
    return l.duration_type === 'permanent' ? '永久（激活后）' : `${l.duration_days} 天（激活起算）`
  }
  if (!l.expires_at) return '永久'
  return formatDate(l.expires_at)
}

const columns = computed<DataTableColumns<License>>(() => [
  {
    title: '授权码',
    key: 'code',
    width: 230,
    render: (l) =>
      h(
        'span',
        {
          class: 'mono license-code',
          style: 'cursor: pointer',
          onClick: () => copyCode(l.code),
          title: '点击复制',
        },
        l.code,
      ),
  },
  {
    title: '产品',
    key: 'product_name',
    width: 110,
    render: (l) => l.product_name ?? '-',
  },
  { title: '客户', key: 'customer_name', width: 120, ellipsis: { tooltip: true }, render: (l) => l.customer_name || '-' },
  { title: '域名', key: 'domain', width: 170, ellipsis: { tooltip: true }, render: (l) => l.domain || '-' },
  { title: '状态', key: 'status', width: 90, render: statusTag },
  {
    title: '期限',
    key: 'duration',
    width: 90,
    render: (l) => durationLabels[l.duration_type] ?? l.duration_type,
  },
  { title: '到期', key: 'expires_at', width: 130, render: expiryText },
  {
    title: '最近心跳',
    key: 'last_heartbeat_at',
    width: 140,
    render: (l) =>
      h(NText, { depth: 3 }, { default: () => (l.last_heartbeat_at ? formatTime(l.last_heartbeat_at) : '-') }),
  },
  {
    title: '版本',
    key: 'last_version',
    width: 90,
    render: (l) => h('span', { class: 'mono' }, l.last_version || '-'),
  },
  {
    title: '操作',
    key: 'actions',
    width: 150,
    render: (l) =>
      h(NSpace, { size: 4 }, {
        default: () => [
          h(
            NButton,
            { size: 'tiny', onClick: () => openDetail(l) },
            { default: () => '详情' },
          ),
          h(
            NDropdown,
            {
              options: actionOptions(l),
              onSelect: (key: string) => onAction(key, l),
              trigger: 'click',
            },
            {
              default: () =>
                h(NButton, { size: 'tiny', quaternary: true }, { default: () => '更多' }),
            },
          ),
        ],
      }),
  },
])

function actionOptions(l: License) {
  const opts: { label: string; key: string; disabled?: boolean }[] = [
    { label: '编辑客户信息', key: 'edit' },
    { label: '续期', key: 'renew', disabled: l.status === 'revoked' },
    { label: '改绑域名', key: 'rebind', disabled: l.status === 'unactivated' },
  ]
  if (l.status === 'revoked') {
    opts.push({ label: '恢复授权', key: 'restore' })
  } else {
    opts.push({ label: '吊销授权', key: 'revoke' })
  }
  opts.push({ label: '重置（解绑重来）', key: 'reset', disabled: l.status === 'unactivated' })
  opts.push({ label: '删除', key: 'delete' })
  return opts
}

function copyCode(code: string) {
  navigator.clipboard.writeText(code).then(
    () => message.success('授权码已复制'),
    () => message.error('复制失败'),
  )
}

// ---- 新建 ----
const showCreate = ref(false)
const creating = ref(false)
const createForm = reactive({
  product_id: null as number | null,
  customer_name: '',
  customer_contact: '',
  remark: '',
  duration_type: 'yearly',
  duration_days: 365,
  count: 1,
})
const createdCodes = ref<string[]>([])

function openCreate() {
  createdCodes.value = []
  showCreate.value = true
}

async function submitCreate() {
  if (!createForm.product_id) {
    message.warning('请选择产品')
    return
  }
  creating.value = true
  try {
    const { data } = await licenseApi.create({
      product_id: createForm.product_id,
      customer_name: createForm.customer_name,
      customer_contact: createForm.customer_contact,
      remark: createForm.remark,
      duration_type: createForm.duration_type,
      duration_days: createForm.duration_days,
      count: createForm.count,
    })
    createdCodes.value = data.items.map((i) => i.code)
    message.success(`已生成 ${data.items.length} 个授权码`)
    await load()
  } catch (err) {
    message.error(extractError(err))
  } finally {
    creating.value = false
  }
}

function copyCreated() {
  copyCode(createdCodes.value.join('\n'))
}

// ---- 详情抽屉 ----
const showDetail = ref(false)
const detail = ref<License | null>(null)
const detailEvents = ref<LicenseEvent[]>([])
const detailHeartbeats = ref<HeartbeatLog[]>([])
const detailLoading = ref(false)

async function openDetail(l: License) {
  showDetail.value = true
  detailLoading.value = true
  try {
    const { data } = await licenseApi.detail(l.id)
    detail.value = data.license
    detailEvents.value = data.events
    detailHeartbeats.value = data.heartbeats
  } catch (err) {
    message.error(extractError(err))
  } finally {
    detailLoading.value = false
  }
}

// ---- 操作弹窗 ----
const showEdit = ref(false)
const editTarget = ref<License | null>(null)
const editForm = reactive({ customer_name: '', customer_contact: '', remark: '' })

const showRenew = ref(false)
const renewTarget = ref<License | null>(null)
const renewForm = reactive({ mode: 'days', days: 365 })

const showRebind = ref(false)
const rebindTarget = ref<License | null>(null)
const rebindDomain = ref('')

const actionBusy = ref(false)

function onAction(key: string, l: License) {
  switch (key) {
    case 'edit':
      editTarget.value = l
      editForm.customer_name = l.customer_name
      editForm.customer_contact = l.customer_contact
      editForm.remark = l.remark
      showEdit.value = true
      break
    case 'renew':
      renewTarget.value = l
      renewForm.mode = 'days'
      renewForm.days = 365
      showRenew.value = true
      break
    case 'rebind':
      rebindTarget.value = l
      rebindDomain.value = l.domain
      showRebind.value = true
      break
    case 'revoke':
      dialog.warning({
        title: '吊销授权',
        content: `吊销后客户站点将在下次心跳时停止对外服务。确定吊销 ${l.code}？`,
        positiveText: '吊销',
        negativeText: '取消',
        onPositiveClick: () => doSimple(() => licenseApi.revoke(l.id), '已吊销'),
      })
      break
    case 'restore':
      doSimple(() => licenseApi.restore(l.id), '已恢复')
      break
    case 'reset':
      dialog.warning({
        title: '重置授权',
        content: `重置将解绑域名 ${l.domain || ''} 并恢复为未激活状态，有效期将在下次激活时重新起算。确定重置？`,
        positiveText: '重置',
        negativeText: '取消',
        onPositiveClick: () => doSimple(() => licenseApi.reset(l.id), '已重置'),
      })
      break
    case 'delete':
      dialog.error({
        title: '删除授权',
        content: `删除后不可恢复，客户站点将无法通过校验。确定删除 ${l.code}？`,
        positiveText: '删除',
        negativeText: '取消',
        onPositiveClick: () => doSimple(() => licenseApi.remove(l.id), '已删除'),
      })
      break
  }
}

async function doSimple(fn: () => Promise<unknown>, okMsg: string) {
  try {
    await fn()
    message.success(okMsg)
    await load()
  } catch (err) {
    message.error(extractError(err))
  }
}

async function submitEdit() {
  if (!editTarget.value) return
  actionBusy.value = true
  try {
    await licenseApi.update(editTarget.value.id, editForm)
    message.success('已保存')
    showEdit.value = false
    await load()
  } catch (err) {
    message.error(extractError(err))
  } finally {
    actionBusy.value = false
  }
}

async function submitRenew() {
  if (!renewTarget.value) return
  actionBusy.value = true
  try {
    if (renewForm.mode === 'permanent') {
      await licenseApi.renew(renewTarget.value.id, { permanent: true })
    } else {
      await licenseApi.renew(renewTarget.value.id, { days: renewForm.days })
    }
    message.success('已续期')
    showRenew.value = false
    await load()
  } catch (err) {
    message.error(extractError(err))
  } finally {
    actionBusy.value = false
  }
}

async function submitRebind() {
  if (!rebindTarget.value) return
  actionBusy.value = true
  try {
    await licenseApi.rebind(rebindTarget.value.id, rebindDomain.value)
    message.success('已改绑')
    showRebind.value = false
    await load()
  } catch (err) {
    message.error(extractError(err))
  } finally {
    actionBusy.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">授权管理</h1>
        <p class="page-sub">发放、续期、改绑、吊销客户授权</p>
      </div>
      <n-button type="primary" @click="openCreate">发放授权</n-button>
    </div>

    <n-card size="small">
      <n-space :size="10" style="margin-bottom: 14px" align="center">
        <n-select
          v-model:value="query.product_id"
          :options="productOptions"
          placeholder="全部产品"
          clearable
          style="width: 160px"
          @update:value="search"
        />
        <n-select
          v-model:value="query.status"
          :options="statusOptions"
          placeholder="全部状态"
          clearable
          style="width: 150px"
          @update:value="search"
        />
        <n-input
          v-model:value="query.q"
          placeholder="搜索授权码 / 客户 / 域名"
          clearable
          style="width: 240px"
          @keyup.enter="search"
          @clear="search"
        />
        <n-button secondary @click="search">搜索</n-button>
      </n-space>

      <n-data-table
        :columns="columns"
        :data="items"
        :loading="loading"
        :bordered="false"
        size="small"
        :row-key="(l: License) => l.id"
        :scroll-x="1250"
      />

      <n-space justify="end" style="margin-top: 14px">
        <n-pagination
          v-model:page="query.page"
          v-model:page-size="query.page_size"
          :item-count="total"
          :page-sizes="[20, 50, 100]"
          show-size-picker
          @update:page="load"
          @update:page-size="search"
        />
      </n-space>
    </n-card>

    <!-- 发放授权 -->
    <n-modal v-model:show="showCreate" preset="card" title="发放授权" style="width: 520px">
      <template v-if="createdCodes.length === 0">
        <n-form label-placement="top">
          <n-form-item label="产品" required>
            <n-select v-model:value="createForm.product_id" :options="productOptions" placeholder="选择产品" />
          </n-form-item>
          <n-space :size="12">
            <n-form-item label="客户名称" style="flex: 1">
              <n-input v-model:value="createForm.customer_name" placeholder="" />
            </n-form-item>
            <n-form-item label="联系方式" style="flex: 1">
              <n-input v-model:value="createForm.customer_contact" placeholder="" />
            </n-form-item>
          </n-space>
          <n-form-item label="授权期限" required>
            <n-radio-group v-model:value="createForm.duration_type">
              <n-radio-button value="yearly">年度（365 天）</n-radio-button>
              <n-radio-button value="permanent">永久</n-radio-button>
              <n-radio-button value="custom">自定义</n-radio-button>
            </n-radio-group>
          </n-form-item>
          <n-form-item v-if="createForm.duration_type === 'custom'" label="自定义天数">
            <n-input-number v-model:value="createForm.duration_days" :min="1" :max="36500" style="width: 100%">
              <template #suffix>天</template>
            </n-input-number>
          </n-form-item>
          <n-form-item label="生成数量">
            <n-input-number v-model:value="createForm.count" :min="1" :max="100" style="width: 100%">
              <template #suffix>个</template>
            </n-input-number>
          </n-form-item>
          <n-form-item label="备注">
            <n-input v-model:value="createForm.remark" type="textarea" :rows="2" placeholder="" />
          </n-form-item>
          <n-text depth="3" style="font-size: 12px; display: block; margin-bottom: 12px">
            有效期从客户激活时起算，而非发放时。
          </n-text>
          <n-space justify="end">
            <n-button @click="showCreate = false">取消</n-button>
            <n-button type="primary" :loading="creating" @click="submitCreate">生成授权码</n-button>
          </n-space>
        </n-form>
      </template>
      <template v-else>
        <n-space vertical :size="12">
          <n-text>以下授权码已生成，请复制发给客户：</n-text>
          <n-card embedded size="small">
            <div v-for="code in createdCodes" :key="code" class="mono" style="line-height: 1.9">
              {{ code }}
            </div>
          </n-card>
          <n-space justify="end">
            <n-button @click="showCreate = false">关闭</n-button>
            <n-button type="primary" @click="copyCreated">复制全部</n-button>
          </n-space>
        </n-space>
      </template>
    </n-modal>

    <!-- 详情 -->
    <n-drawer v-model:show="showDetail" :width="560">
      <n-drawer-content :title="detail ? detail.code : '授权详情'" closable>
        <template v-if="detail">
          <n-descriptions :column="2" size="small" label-placement="left" bordered>
            <n-descriptions-item label="产品">{{ detail.product_name }}</n-descriptions-item>
            <n-descriptions-item label="状态">
              <n-tag size="small" :type="statusTypes[detail.effective_status]" :bordered="false">
                {{ statusLabels[detail.effective_status] }}
              </n-tag>
            </n-descriptions-item>
            <n-descriptions-item label="客户">{{ detail.customer_name || '-' }}</n-descriptions-item>
            <n-descriptions-item label="联系方式">{{ detail.customer_contact || '-' }}</n-descriptions-item>
            <n-descriptions-item label="期限类型">{{ durationLabels[detail.duration_type] }}</n-descriptions-item>
            <n-descriptions-item label="到期时间">{{
              detail.status === 'unactivated'
                ? (detail.duration_type === 'permanent' ? '永久（激活后）' : `激活后 ${detail.duration_days} 天`)
                : detail.expires_at
                  ? formatTime(detail.expires_at)
                  : '永久'
            }}</n-descriptions-item>
            <n-descriptions-item label="绑定域名">{{ detail.domain || '-' }}</n-descriptions-item>
            <n-descriptions-item label="激活时间">{{ formatTime(detail.activated_at) }}</n-descriptions-item>
            <n-descriptions-item label="最近心跳">{{ formatTime(detail.last_heartbeat_at) }}</n-descriptions-item>
            <n-descriptions-item label="运行版本">
              <span class="mono">{{ detail.last_version || '-' }}</span>
            </n-descriptions-item>
            <n-descriptions-item label="来源 IP">
              <span class="mono">{{ detail.last_ip || '-' }}</span>
            </n-descriptions-item>
            <n-descriptions-item label="创建时间">{{ formatTime(detail.created_at) }}</n-descriptions-item>
            <n-descriptions-item v-if="detail.remark" label="备注" :span="2">{{ detail.remark }}</n-descriptions-item>
          </n-descriptions>

          <n-tabs type="line" style="margin-top: 16px">
            <n-tab-pane name="events" tab="操作记录">
              <n-timeline v-if="detailEvents.length" style="margin-top: 8px">
                <n-timeline-item
                  v-for="e in detailEvents"
                  :key="e.id"
                  :title="eventLabels[e.type] ?? e.type"
                  :content="e.detail"
                  :time="formatTime(e.created_at)"
                />
              </n-timeline>
              <n-empty v-else description="暂无记录" style="padding: 40px 0" />
            </n-tab-pane>
            <n-tab-pane name="heartbeats" tab="心跳记录（近 50 条）">
              <div v-if="detailHeartbeats.length" class="hb-list">
                <div v-for="hb in detailHeartbeats" :key="hb.id" class="hb-row">
                  <n-tag size="tiny" :bordered="false" :type="hb.result === 'active' ? 'success' : 'warning'">
                    {{ hb.result === 'active' ? '正常' : hb.result }}
                  </n-tag>
                  <span class="mono hb-ver">{{ hb.version || '-' }}</span>
                  <n-text depth="3" style="font-size: 12px">{{ hb.domain }}</n-text>
                  <n-text depth="3" class="mono" style="font-size: 12px">{{ hb.ip }}</n-text>
                  <n-text depth="3" style="font-size: 12px; margin-left: auto">{{ formatTime(hb.created_at) }}</n-text>
                </div>
              </div>
              <n-empty v-else description="暂无心跳" style="padding: 40px 0" />
            </n-tab-pane>
          </n-tabs>
        </template>
      </n-drawer-content>
    </n-drawer>

    <!-- 编辑客户信息 -->
    <n-modal v-model:show="showEdit" preset="card" title="编辑客户信息" style="width: 440px">
      <n-form label-placement="top">
        <n-form-item label="客户名称">
          <n-input v-model:value="editForm.customer_name" />
        </n-form-item>
        <n-form-item label="联系方式">
          <n-input v-model:value="editForm.customer_contact" />
        </n-form-item>
        <n-form-item label="备注">
          <n-input v-model:value="editForm.remark" type="textarea" :rows="2" />
        </n-form-item>
        <n-space justify="end">
          <n-button @click="showEdit = false">取消</n-button>
          <n-button type="primary" :loading="actionBusy" @click="submitEdit">保存</n-button>
        </n-space>
      </n-form>
    </n-modal>

    <!-- 续期 -->
    <n-modal v-model:show="showRenew" preset="card" title="续期授权" style="width: 440px">
      <n-form label-placement="top">
        <n-form-item label="续期方式">
          <n-radio-group v-model:value="renewForm.mode">
            <n-radio-button value="days">增加天数</n-radio-button>
            <n-radio-button value="permanent">转为永久</n-radio-button>
          </n-radio-group>
        </n-form-item>
        <n-form-item v-if="renewForm.mode === 'days'" label="天数">
          <n-input-number v-model:value="renewForm.days" :min="1" :max="36500" style="width: 100%">
            <template #suffix>天</template>
          </n-input-number>
        </n-form-item>
        <n-text depth="3" style="font-size: 12px; display: block; margin-bottom: 12px">
          未过期授权从原到期日累加；已过期授权从今天起算。
        </n-text>
        <n-space justify="end">
          <n-button @click="showRenew = false">取消</n-button>
          <n-button type="primary" :loading="actionBusy" @click="submitRenew">确认续期</n-button>
        </n-space>
      </n-form>
    </n-modal>

    <!-- 改绑域名 -->
    <n-modal v-model:show="showRebind" preset="card" title="改绑域名" style="width: 440px">
      <n-form label-placement="top">
        <n-form-item label="新域名">
          <n-input v-model:value="rebindDomain" placeholder="如：example.com" />
        </n-form-item>
        <n-text depth="3" style="font-size: 12px; display: block; margin-bottom: 12px">
          改绑后旧域名站点将无法通过校验，新域名站点无需重新激活。
        </n-text>
        <n-space justify="end">
          <n-button @click="showRebind = false">取消</n-button>
          <n-button type="primary" :loading="actionBusy" @click="submitRebind">确认改绑</n-button>
        </n-space>
      </n-form>
    </n-modal>
  </div>
</template>

<style scoped>
.license-code:hover {
  color: #2ea981;
}

.hb-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.hb-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hb-ver {
  font-size: 12px;
  min-width: 52px;
}
</style>
