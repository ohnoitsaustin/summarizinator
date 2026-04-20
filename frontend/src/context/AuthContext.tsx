import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { getCurrentUser, fetchAuthSession, signOut } from 'aws-amplify/auth'

export type AuthUser = { id: string; email: string }

type AuthContextType = {
  user: AuthUser | null
  loading: boolean
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadUser() {
    try {
      const cognitoUser = await getCurrentUser()
      const session = await fetchAuthSession()
      const claims = session.tokens?.idToken?.payload
      const email = (claims?.email as string | undefined) ?? cognitoUser.signInDetails?.loginId ?? ''
      setUser({ id: cognitoUser.userId, email })
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUser() }, [])

  async function logout() {
    await signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser: loadUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
