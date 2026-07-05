<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { NAlert, NButton, NCard, NForm, NFormItem, NInput, useMessage } from 'naive-ui'
import { authApi, extractError } from '@/api'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const message = useMessage()

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const saving = ref(false)

async function submit() {
  if (!oldPassword.value || !newPassword.value) {
    message.warning('请填写原密码和新密码')
    return
  }
  if (newPassword.value.length < 6) {
    message.warning('新密码至少 6 位')
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    message.warning('两次输入的新密码不一致')
    return
  }
  saving.value = true
  try {
    await authApi.changePassword(oldPassword.value, newPassword.value)
    auth.markPasswordChanged()
    message.success('密码已修改')
    router.push({ name: 'dashboard' })
  } catch (err) {
    message.error(extractError(err))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">修改密码</h2>
        <p class="page-sub">首次登录必须设置新的管理员密码</p>
      </div>
    </div>

    <n-card :bordered="false" style="max-width: 520px">
      <n-alert v-if="auth.mustChangePassword" type="warning" :bordered="false" style="margin-bottom: 18px">
        当前账号仍在使用初始密码，修改后才能进入其他后台页面。
      </n-alert>
      <n-form label-placement="top" @keyup.enter="submit">
        <n-form-item label="原密码">
          <n-input v-model:value="oldPassword" type="password" show-password-on="click" />
        </n-form-item>
        <n-form-item label="新密码">
          <n-input v-model:value="newPassword" type="password" show-password-on="click" />
        </n-form-item>
        <n-form-item label="确认新密码">
          <n-input v-model:value="confirmPassword" type="password" show-password-on="click" />
        </n-form-item>
        <n-button type="primary" :loading="saving" @click="submit">保存新密码</n-button>
      </n-form>
    </n-card>
  </div>
</template>
