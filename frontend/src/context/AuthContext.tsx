import { createContext, useContext, useState, type ReactNode } from 'react'

type AuthUser = { id: string; email: string; githubLogin: string }

type AuthContextType = {
  token: string | null
  user: AuthUser | null
  login: (token: string, user: AuthUser) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('user')
    return stored ? (JSON.parse(stored) as AuthUser) : null
  })

  function login(t: string, u: AuthUser) {
    localStorage.setItem('token', t)
    localStorage.setItem('user', JSON.stringify(u))
    setToken(t)
    setUser(u)
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
