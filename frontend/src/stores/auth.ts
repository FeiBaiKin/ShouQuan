import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authApi } from '@/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'))
  const username = ref<string>(localStorage.getItem('username') ?? '')

  async function login(user: string, password: string) {
    const { data } = await authApi.login(user, password)
    token.value = data.token
    username.value = data.username
    localStorage.setItem('token', data.token)
    localStorage.setItem('username', data.username)
  }

  function logout() {
    token.value = null
    username.value = ''
    localStorage.removeItem('token')
    localStorage.removeItem('username')
  }

  return { token, username, login, logout }
})
