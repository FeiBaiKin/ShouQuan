<script setup lang="ts">
import { inject, type Ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { useRoute } from 'vue-router'
import { NIcon } from 'naive-ui'
import { Sun, Moon, ExternalLink } from '@vicons/tabler'

const route = useRoute()
const isDark = inject<Ref<boolean>>('isDark')!
</script>

<template>
  <div class="min-h-[100dvh] flex flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
    <!-- 顶部导航 -->
    <header class="sticky top-0 z-40 border-b border-zinc-200/70 dark:border-zinc-800/70 bg-white/80 dark:bg-zinc-950/80 backdrop-blur">
      <div class="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
        <RouterLink to="/" class="flex items-center gap-2 font-semibold tracking-tight">
          <span class="inline-block h-6 w-6 rounded-md bg-emerald-500"></span>
          <span>授权中心</span>
        </RouterLink>
        <nav class="flex items-center gap-2 text-sm">
          <RouterLink
            to="/"
            class="px-3 py-1.5 rounded-md transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
            :class="route.name === 'home' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-600 dark:text-zinc-400'"
          >
            首页
          </RouterLink>
          <a
            href="https://home.xzji.top"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-zinc-600 dark:text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            演示站点
            <NIcon :component="ExternalLink" size="14" class="text-zinc-400 dark:text-zinc-500" />
          </a>
          <button
            @click="isDark = !isDark"
            class="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100 active:scale-[0.95]"
            :aria-label="isDark ? '切换到浅色模式' : '切换到深色模式'"
            :title="isDark ? '切换到浅色模式' : '切换到深色模式'"
          >
            <NIcon :component="isDark ? Sun : Moon" size="18" />
          </button>
        </nav>
      </div>
    </header>

    <!-- 主体 -->
    <main class="flex-1">
      <RouterView />
    </main>

    <!-- 底部 -->
    <footer class="border-t border-zinc-200/70 dark:border-zinc-800/70">
      <div class="mx-auto max-w-6xl px-5 py-8 text-sm text-zinc-500 dark:text-zinc-500 flex flex-col sm:flex-row gap-2 justify-between">
        <span>软件授权与自动升级服务</span>
        <span class="text-zinc-400">支付成功后授权码即时生成并发至邮箱</span>
      </div>
    </footer>
  </div>
</template>
