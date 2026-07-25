'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { authApi } from './api'

interface AuthState {
  token: string | null
  username: string
  mustChangePassword: boolean
}

interface AuthContextValue extends AuthState {
  login: (user: string, password: string) => Promise<void>
  markPasswordChanged: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readInitial(): AuthState {
  if (typeof window === 'undefined') {
    return { token: null, username: '', mustChangePassword: false }
  }
  return {
    token: localStorage.getItem('token'),
    username: localStorage.getItem('username') ?? '',
    mustChangePassword: localStorage.getItem('must_change_password') === 'true',
  }
}

// 后台鉴权状态（对应旧 Pinia auth store），以 localStorage 为持久层。
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(readInitial)

  const login = useCallback(async (user: string, password: string) => {
    const { data } = await authApi.login(user, password)
    localStorage.setItem('token', data.token)
    localStorage.setItem('username', data.username)
    localStorage.setItem('must_change_password', data.must_change_password ? 'true' : 'false')
    setState({
      token: data.token,
      username: data.username,
      mustChangePassword: data.must_change_password,
    })
  }, [])

  const markPasswordChanged = useCallback(() => {
    localStorage.setItem('must_change_password', 'false')
    setState((s) => ({ ...s, mustChangePassword: false }))
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    localStorage.removeItem('must_change_password')
    setState({ token: null, username: '', mustChangePassword: false })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, markPasswordChanged, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必须在 AdminAuthProvider 内使用')
  return ctx
}
