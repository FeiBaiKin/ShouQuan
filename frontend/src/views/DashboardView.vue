<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  NCard,
  NGrid,
  NGi,
  NSpin,
  NTable,
  NTag,
  NEmpty,
  NText,
  useMessage,
} from 'naive-ui'
import { dashboardApi, extractError } from '@/api'
import type { DashboardData } from '@/types'
import { eventLabels, formatDate, formatTime } from '@/utils/format'

const message = useMessage()
const data = ref<DashboardData | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    data.value = (await dashboardApi.get()).data
  } catch (err) {
    message.error(extractError(err))
  } finally {
    loading.value = false
  }
})

const stats = [
  { key: 'license_total', label: '授权总数' },
  { key: 'license_active', label: '有效授权' },
  { key: 'sites_active_24h', label: '活跃站点（24h 有心跳）' },
  { key: 'license_expiring', label: '30 天内到期' },
  { key: 'license_unactivated', label: '未激活' },
  { key: 'license_revoked', label: '已吊销' },
] as const
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">仪表盘</h1>
        <p class="page-sub">授权与更新总览</p>
      </div>
    </div>

    <n-spin :show="loading">
      <template v-if="data">
        <n-grid :cols="6" :x-gap="12" :y-gap="12" item-responsive responsive="screen">
          <n-gi v-for="s in stats" :key="s.key" span="6 s:3 m:2 l:1">
            <n-card size="small">
              <div class="stat-label">{{ s.label }}</div>
              <div class="stat-value mono">{{ data[s.key] }}</div>
            </n-card>
          </n-gi>
        </n-grid>

        <n-grid :cols="2" :x-gap="12" :y-gap="12" style="margin-top: 12px" item-responsive responsive="screen">
          <n-gi span="2 m:1">
            <n-card title="产品概况" size="small">
              <n-table v-if="data.products.length" size="small" :bordered="false" :single-line="false">
                <thead>
                  <tr>
                    <th>产品</th>
                    <th>标识</th>
                    <th>授权数</th>
                    <th>有效</th>
                    <th>最新版本</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in data.products" :key="p.id">
                    <td>{{ p.name }}</td>
                    <td><span class="mono">{{ p.slug }}</span></td>
                    <td class="mono">{{ p.license_count }}</td>
                    <td class="mono">{{ p.active_count }}</td>
                    <td><span class="mono">{{ p.latest_version || '-' }}</span></td>
                  </tr>
                </tbody>
              </n-table>
              <n-empty v-else description="还没有产品，先到「产品管理」创建一个">
                <template #extra>
                  <router-link to="/products">前往创建</router-link>
                </template>
              </n-empty>
            </n-card>
          </n-gi>

          <n-gi span="2 m:1">
            <n-card title="即将到期（30 天内）" size="small">
              <n-table v-if="data.expiring_list.length" size="small" :bordered="false" :single-line="false">
                <thead>
                  <tr>
                    <th>授权码</th>
                    <th>客户</th>
                    <th>域名</th>
                    <th>到期日</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="l in data.expiring_list" :key="l.id">
                    <td><span class="mono">{{ l.code }}</span></td>
                    <td>{{ l.customer_name || '-' }}</td>
                    <td>{{ l.domain || '-' }}</td>
                    <td><n-tag size="small" type="warning">{{ formatDate(l.expires_at) }}</n-tag></td>
                  </tr>
                </tbody>
              </n-table>
              <n-empty v-else description="没有即将到期的授权" />
            </n-card>
          </n-gi>
        </n-grid>

        <n-card title="最近动态" size="small" style="margin-top: 12px">
          <n-table v-if="data.recent_events.length" size="small" :bordered="false" :single-line="false">
            <thead>
              <tr>
                <th style="width: 90px">操作</th>
                <th style="width: 220px">授权码</th>
                <th>详情</th>
                <th style="width: 150px">时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in data.recent_events" :key="e.id">
                <td>
                  <n-tag size="small" :bordered="false">{{ eventLabels[e.type] ?? e.type }}</n-tag>
                </td>
                <td><span class="mono">{{ e.code || '-' }}</span></td>
                <td><n-text depth="3">{{ e.detail }}</n-text></td>
                <td><n-text depth="3">{{ formatTime(e.created_at) }}</n-text></td>
              </tr>
            </tbody>
          </n-table>
          <n-empty v-else description="暂无动态" />
        </n-card>
      </template>
    </n-spin>
  </div>
</template>

<style scoped>
.stat-label {
  font-size: 12px;
  opacity: 0.6;
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-value {
  font-size: 26px;
  font-weight: 600;
  line-height: 1;
}
</style>
