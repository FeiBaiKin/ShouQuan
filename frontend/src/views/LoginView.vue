<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NCard, NForm, NFormItem, NIcon, NInput, useMessage } from 'naive-ui'
import { ShieldCheck } from '@vicons/tabler'
import { useAuthStore } from '@/stores/auth'
import { extractError } from '@/api'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const message = useMessage()

const username = ref('')
const password = ref('')
const loading = ref(false)

async function submit() {
  if (!username.value || !password.value) {
    message.warning('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    await auth.login(username.value, password.value)
    router.push((route.query.redirect as string) ?? '/admin')
  } catch (err) {
    message.error(extractError(err))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-wrap">
    <n-card class="login-card" :bordered="false">
      <div class="login-head">
        <n-icon size="34" color="#2ea981"><ShieldCheck /></n-icon>
        <h1>授权升级中心</h1>
        <p>程序授权与在线更新管理</p>
      </div>
      <n-form label-placement="top" @keyup.enter="submit">
        <n-form-item label="用户名">
          <n-input v-model:value="username" placeholder="" autofocus />
        </n-form-item>
        <n-form-item label="密码">
          <n-input v-model:value="password" type="password" show-password-on="click" placeholder="" />
        </n-form-item>
        <n-button type="primary" block :loading="loading" @click="submit">登 录</n-button>
      </n-form>
    </n-card>
  </div>
</template>

<style scoped>
.login-wrap {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.login-card {
  width: 380px;
  max-width: 100%;
}

.login-head {
  text-align: center;
  margin-bottom: 24px;
}

.login-head h1 {
  font-size: 20px;
  margin: 10px 0 4px;
}

.login-head p {
  margin: 0;
  font-size: 13px;
  opacity: 0.55;
}
</style>
