<script setup lang="ts">
import { computed, provide, ref, watchEffect } from 'vue'
import {
  NConfigProvider,
  NDialogProvider,
  NGlobalStyle,
  NMessageProvider,
  darkTheme,
  zhCN,
  dateZhCN,
  type GlobalThemeOverrides,
} from 'naive-ui'

const isDark = ref(localStorage.getItem('theme') !== 'light')
watchEffect(() => {
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', isDark.value)
  }
})

// 提供给布局的主题切换
provide('isDark', isDark)

const theme = computed(() => (isDark.value ? darkTheme : null))

// 单一强调色：青绿。避免默认蓝与 AI 紫。
const overrides = computed<GlobalThemeOverrides>(() => ({
  common: {
    primaryColor: '#2ea981',
    primaryColorHover: '#3cbd93',
    primaryColorPressed: '#26906d',
    primaryColorSuppl: '#2ea981',
    borderRadius: '6px',
    fontSize: '14px',
    ...(isDark.value
      ? {
          bodyColor: '#101418',
          cardColor: '#161b21',
          modalColor: '#1a2027',
          popoverColor: '#1e252d',
        }
      : {
          bodyColor: '#f5f6f7',
        }),
  },
}))
</script>

<template>
  <n-config-provider
    :theme="theme"
    :theme-overrides="overrides"
    :locale="zhCN"
    :date-locale="dateZhCN"
  >
    <n-global-style />
    <n-message-provider placement="top-right">
      <n-dialog-provider>
        <router-view />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
