<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NGi,
  NGrid,
  NInput,
  NInputNumber,
  NSpace,
  NText,
  useMessage,
} from 'naive-ui'
import { authApi, extractError, settingsApi } from '@/api'

const message = useMessage()

const settings = reactive({ heartbeat_interval_hours: 6, grace_period_days: 7 })
const settingsBusy = ref(false)

const pwd = reactive({ old_password: '', new_password: '', confirm: '' })
const pwdBusy = ref(false)

onMounted(async () => {
  try {
    const { data } = await settingsApi.get()
    settings.heartbeat_interval_hours = data.heartbeat_interval_hours
    settings.grace_period_days = data.grace_period_days
  } catch (err) {
    message.error(extractError(err))
  }
})

async function saveSettings() {
  settingsBusy.value = true
  try {
    await settingsApi.update({ ...settings })
    message.success('已保存，客户端将在下次心跳时获取新参数')
  } catch (err) {
    message.error(extractError(err))
  } finally {
    settingsBusy.value = false
  }
}

async function changePassword() {
  if (!pwd.old_password || !pwd.new_password) {
    message.warning('请填写原密码和新密码')
    return
  }
  if (pwd.new_password.length < 6) {
    message.warning('新密码至少 6 位')
    return
  }
  if (pwd.new_password !== pwd.confirm) {
    message.warning('两次输入的新密码不一致')
    return
  }
  pwdBusy.value = true
  try {
    await authApi.changePassword(pwd.old_password, pwd.new_password)
    message.success('密码已修改')
    pwd.old_password = pwd.new_password = pwd.confirm = ''
  } catch (err) {
    message.error(extractError(err))
  } finally {
    pwdBusy.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">系统设置</h1>
        <p class="page-sub">授权校验参数与账号安全</p>
      </div>
    </div>

    <n-grid :cols="2" :x-gap="12" :y-gap="12" item-responsive responsive="screen">
      <n-gi span="2 m:1">
        <n-card title="授权校验参数" size="small">
          <n-form label-placement="top">
            <n-form-item label="心跳间隔（小时）">
              <n-input-number
                v-model:value="settings.heartbeat_interval_hours"
                :min="1"
                :max="168"
                style="width: 100%"
              />
            </n-form-item>
            <n-form-item label="断网宽限期（天）">
              <n-input-number
                v-model:value="settings.grace_period_days"
                :min="0"
                :max="90"
                style="width: 100%"
              />
            </n-form-item>
            <n-text depth="3" style="font-size: 12px; display: block; margin-bottom: 14px">
              客户站点每隔「心跳间隔」向本中心校验一次授权；连不上服务器时，凭本地缓存凭证最多可继续运行「宽限期」天数，超过后停止对外服务。
            </n-text>
            <n-button type="primary" :loading="settingsBusy" @click="saveSettings">保存设置</n-button>
          </n-form>
        </n-card>
      </n-gi>

      <n-gi span="2 m:1">
        <n-card title="修改密码" size="small">
          <n-form label-placement="top">
            <n-form-item label="原密码">
              <n-input v-model:value="pwd.old_password" type="password" show-password-on="click" placeholder="" />
            </n-form-item>
            <n-form-item label="新密码">
              <n-input v-model:value="pwd.new_password" type="password" show-password-on="click" placeholder="至少 6 位" />
            </n-form-item>
            <n-form-item label="确认新密码">
              <n-input v-model:value="pwd.confirm" type="password" show-password-on="click" placeholder="" @keyup.enter="changePassword" />
            </n-form-item>
            <n-space>
              <n-button type="primary" :loading="pwdBusy" @click="changePassword">修改密码</n-button>
            </n-space>
          </n-form>
        </n-card>
      </n-gi>
    </n-grid>
  </div>
</template>
