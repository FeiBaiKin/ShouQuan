<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  NButton,
  NCard,
  NDivider,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NSpace,
  NTabPane,
  NTabs,
  useMessage,
} from 'naive-ui'
import { extractError, paymentConfigApi } from '@/api'

const message = useMessage()
const loading = ref(true)
const saving = ref(false)
const testing = ref(false)

// 支付配置
const payment = ref<Record<string, string>>({})
// 邮件配置
const email = ref<Record<string, string>>({})
// 站点配置
const site = ref<Record<string, string>>({})

const enabledProviders = ref<string[]>([])
const providerOptions = [
  { label: '支付宝', value: 'alipay' },
  { label: '微信支付', value: 'wechat' },
]
const aliSceneOptions = [
  { label: '电脑网站支付 page（跳转收银台）', value: 'page' },
  { label: '当面付 precreate（扫码）', value: 'precreate' },
]

const testEmailTo = ref('')

async function load() {
  loading.value = true
  try {
    const { data } = await paymentConfigApi.get()
    payment.value = { ...data.payment }
    email.value = { ...data.email }
    site.value = { ...data.site }
    // 解析已启用支付方式
    try {
      enabledProviders.value = payment.value.payment_enabled_providers
        ? JSON.parse(payment.value.payment_enabled_providers)
        : []
    } catch {
      enabledProviders.value = []
    }
  } catch (err) {
    message.error(extractError(err))
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function save() {
  // 同步 enabled_providers 回字符串
  payment.value.payment_enabled_providers = JSON.stringify(enabledProviders.value)
  saving.value = true
  try {
    await paymentConfigApi.update({ payment: payment.value, email: email.value, site: site.value })
    message.success('配置已保存')
    await load()
  } catch (err) {
    message.error(extractError(err))
  } finally {
    saving.value = false
  }
}

async function testEmail() {
  if (!testEmailTo.value) {
    message.warning('请填写收件邮箱')
    return
  }
  testing.value = true
  try {
    await paymentConfigApi.testEmail(testEmailTo.value)
    message.success('测试邮件已发送，请查收')
  } catch (err) {
    message.error(extractError(err))
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">支付与邮件配置</h2>
        <p class="page-sub">配置支付通道、SMTP 邮件与站点信息</p>
      </div>
      <n-button type="primary" :loading="saving" @click="save">保存配置</n-button>
    </div>

    <n-tabs type="line" v-if="!loading">
      <!-- 支付配置 -->
      <n-tab-pane name="payment" tab="支付配置">
        <n-card :bordered="false">
          <n-form label-placement="top" size="small">
            <n-form-item label="启用的支付方式">
              <n-select
                v-model:value="enabledProviders"
                :options="providerOptions"
                multiple
                placeholder="选择启用的支付方式"
                style="max-width: 360px"
              />
            </n-form-item>
            <n-form-item label="站点公网地址（用于拼接回调 URL）">
              <n-input v-model:value="payment.payment_site_url" placeholder="https://auth.example.com" style="max-width: 360px" />
            </n-form-item>

            <n-divider>微信支付 V3</n-divider>
            <n-space vertical :size="10">
              <n-form-item label="AppID">
                <n-input v-model:value="payment.payment_wx_appid" placeholder="wx 开头的应用 ID" />
              </n-form-item>
              <n-form-item label="商户号 MchID">
                <n-input v-model:value="payment.payment_wx_mchid" />
              </n-form-item>
              <n-form-item label="证书序列号">
                <n-input v-model:value="payment.payment_wx_serial_no" />
              </n-form-item>
              <n-form-item label="APIv3 密钥（32 字节）">
                <n-input v-model:value="payment.payment_wx_api_v3_key" type="password" show-password-on="click" />
              </n-form-item>
              <n-form-item label="商户私钥（PEM）">
                <n-input v-model:value="payment.payment_wx_private_key" type="textarea" :rows="5" placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----" />
              </n-form-item>
              <n-form-item label="异步通知 URL（留空则自动拼接）">
                <n-input v-model:value="payment.payment_wx_notify_url" placeholder="https://auth.example.com/api/payment/callback/wechat" />
              </n-form-item>
            </n-space>

            <n-divider>支付宝</n-divider>
            <n-space vertical :size="10">
              <n-form-item label="应用 AppID">
                <n-input v-model:value="payment.payment_ali_appid" />
              </n-form-item>
              <n-form-item label="应用私钥（PEM）">
                <n-input v-model:value="payment.payment_ali_private_key" type="textarea" :rows="5" placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----" />
              </n-form-item>
              <n-form-item label="支付宝公钥（PEM）">
                <n-input v-model:value="payment.payment_ali_public_key" type="textarea" :rows="5" placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----" />
              </n-form-item>
              <n-form-item label="支付场景">
                <n-select v-model:value="payment.payment_ali_scene" :options="aliSceneOptions" style="max-width: 360px" />
              </n-form-item>
              <n-form-item label="异步通知 URL（留空则自动拼接）">
                <n-input v-model:value="payment.payment_ali_notify_url" />
              </n-form-item>
              <n-form-item label="同步返回 URL（留空则自动拼接）">
                <n-input v-model:value="payment.payment_ali_return_url" />
              </n-form-item>
            </n-space>
          </n-form>
        </n-card>
      </n-tab-pane>

      <!-- 邮件配置 -->
      <n-tab-pane name="email" tab="邮件配置">
        <n-card :bordered="false">
          <n-form label-placement="top" size="small">
            <n-space vertical :size="10">
              <n-form-item label="SMTP 服务器">
                <n-input v-model:value="email.email_smtp_host" placeholder="smtp.example.com" style="max-width: 320px" />
              </n-form-item>
              <n-form-item label="端口">
                <n-input v-model:value="email.email_smtp_port" placeholder="465（SSL）或 587（STARTTLS）" style="max-width: 200px" />
              </n-form-item>
              <n-form-item label="用户名">
                <n-input v-model:value="email.email_smtp_user" placeholder="发信邮箱地址" style="max-width: 320px" />
              </n-form-item>
              <n-form-item label="密码 / 授权码">
                <n-input v-model:value="email.email_smtp_pass" type="password" show-password-on="click" style="max-width: 320px" />
              </n-form-item>
              <n-form-item label="发件人名称">
                <n-input v-model:value="email.email_from_name" placeholder="授权中心" style="max-width: 240px" />
              </n-form-item>
            </n-space>
            <n-divider />
            <n-form-item label="发送测试邮件">
              <n-space align="center">
                <n-input v-model:value="testEmailTo" placeholder="收件邮箱" style="width: 260px" />
                <n-button :loading="testing" @click="testEmail">发送测试</n-button>
              </n-space>
            </n-form-item>
            <p style="font-size: 12px; opacity: 0.6; margin: 0">
              提示：测试邮件使用当前已保存的配置，请先点击顶部「保存配置」。
            </p>
          </n-form>
        </n-card>
      </n-tab-pane>

      <!-- 站点配置 -->
      <n-tab-pane name="site" tab="站点配置">
        <n-card :bordered="false">
          <n-form label-placement="top" size="small">
            <n-form-item label="站点名称">
              <n-input v-model:value="site.site_name" placeholder="授权中心" style="max-width: 320px" />
            </n-form-item>
          </n-form>
        </n-card>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>
