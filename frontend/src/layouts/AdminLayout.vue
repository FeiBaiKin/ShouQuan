<script setup lang="ts">
import { computed, h, inject, type Component, type Ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  NIcon,
  NLayout,
  NLayoutSider,
  NLayoutHeader,
  NLayoutContent,
  NMenu,
  NSpace,
  NButton,
  NDropdown,
  NText,
  type MenuOption,
} from 'naive-ui'
import {
  Dashboard,
  Box,
  Key,
  Package,
  Settings,
  Moon,
  Sun,
  User,
  ShieldCheck,
  CreditCard,
  Receipt,
  Ticket,
  ExternalLink,
} from '@vicons/tabler'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const isDark = inject<Ref<boolean>>('isDark')!

function renderIcon(icon: Component) {
  return () => h(NIcon, null, { default: () => h(icon) })
}

const menuOptions: MenuOption[] = [
  {
    label: () => h(RouterLink, { to: { name: 'dashboard' } }, { default: () => '仪表盘' }),
    key: 'dashboard',
    icon: renderIcon(Dashboard),
  },
  {
    label: () => h(RouterLink, { to: { name: 'products' } }, { default: () => '产品管理' }),
    key: 'products',
    icon: renderIcon(Box),
  },
  {
    label: () => h(RouterLink, { to: { name: 'plans' } }, { default: () => '套餐管理' }),
    key: 'plans',
    icon: renderIcon(Ticket),
  },
  {
    label: () => h(RouterLink, { to: { name: 'licenses' } }, { default: () => '授权管理' }),
    key: 'licenses',
    icon: renderIcon(Key),
  },
  {
    label: () => h(RouterLink, { to: { name: 'orders' } }, { default: () => '订单管理' }),
    key: 'orders',
    icon: renderIcon(Receipt),
  },
  {
    label: () => h(RouterLink, { to: { name: 'releases' } }, { default: () => '版本管理' }),
    key: 'releases',
    icon: renderIcon(Package),
  },
  {
    label: () => h(RouterLink, { to: { name: 'payment-config' } }, { default: () => '支付与邮件' }),
    key: 'payment-config',
    icon: renderIcon(CreditCard),
  },
  {
    label: () => h(RouterLink, { to: { name: 'settings' } }, { default: () => '系统设置' }),
    key: 'settings',
    icon: renderIcon(Settings),
  },
]

const activeKey = computed(() => (route.name as string) ?? 'dashboard')

const userOptions = [{ label: '退出登录', key: 'logout' }]

function onUserAction(key: string) {
  if (key === 'logout') {
    auth.logout()
    router.push({ name: 'login' })
  }
}
</script>

<template>
  <n-layout style="height: 100vh" has-sider>
    <n-layout-sider
      bordered
      collapse-mode="width"
      :collapsed-width="64"
      :width="220"
      show-trigger
      :native-scrollbar="false"
    >
      <div class="brand">
        <n-icon size="22" color="#2ea981"><ShieldCheck /></n-icon>
        <span class="brand-name">授权升级中心</span>
      </div>
      <n-menu :options="menuOptions" :value="activeKey" :collapsed-width="64" />
    </n-layout-sider>

    <n-layout>
      <n-layout-header bordered class="topbar">
        <n-space align="center" :size="8">
          <n-button quaternary size="small" tag="a" href="/" target="_blank">
            <template #icon>
              <n-icon><ExternalLink /></n-icon>
            </template>
            前台
          </n-button>
        </n-space>
        <n-space align="center" :size="12">
          <n-button quaternary circle size="small" @click="isDark = !isDark">
            <template #icon>
              <n-icon><Moon v-if="!isDark" /><Sun v-else /></n-icon>
            </template>
          </n-button>
          <n-dropdown :options="userOptions" @select="onUserAction">
            <n-button quaternary size="small">
              <template #icon>
                <n-icon><User /></n-icon>
              </template>
              <n-text>{{ auth.username }}</n-text>
            </n-button>
          </n-dropdown>
        </n-space>
      </n-layout-header>
      <n-layout-content :native-scrollbar="false" style="height: calc(100vh - 56px)">
        <router-view />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<style scoped>
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  padding: 0 18px;
  font-weight: 600;
  font-size: 15px;
  overflow: hidden;
  white-space: nowrap;
}

.topbar {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}
</style>
