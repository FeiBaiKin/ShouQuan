import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authApi } from '@/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'))
  const username = ref<string>(localStorage.getItem('username') ?? '')
  const mustChangePassword = ref<boolean>(localStorage.getItem('must_change_password') === 'true')

  async function login(user: string, password: string) {
    const { data } = await authApi.login(user, password)
    token.value = data.token
    username.value = data.username
    mustChangePassword.value = data.must_change_password
    localStorage.setItem('token', data.token)
    localStorage.setItem('username', data.username)
    localStorage.setItem('must_change_password', data.must_change_password ? 'true' : 'false')
  }

  function markPasswordChanged() {
    mustChangePassword.value = false
    localStorage.setItem('must_change_password', 'false')
  }

  function logout() {
    token.value = null
    username.value = ''
    mustChangePassword.value = false
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    localStorage.removeItem('must_change_password')
  }

  return { token, username, mustChangePassword, login, markPasswordChanged, logout }
})
