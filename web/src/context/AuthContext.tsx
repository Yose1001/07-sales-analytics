import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import client from '../api/client'
import { TokenResponse, User } from '../types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }
    client
      .get<User>('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false))
  }, [])

  const applyToken = (data: TokenResponse) => {
    localStorage.setItem('token', data.access_token)
    setUser(data.user)
  }

  const login = async (email: string, password: string) => {
    const res = await client.post<TokenResponse>('/auth/login', { email, password })
    applyToken(res.data)
  }

  const register = async (name: string, email: string, password: string) => {
    const res = await client.post<TokenResponse>('/auth/register', {
      name,
      email,
      password,
    })
    applyToken(res.data)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth ต้องใช้ภายใน AuthProvider')
  return ctx
}
