import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'

export default function AuthCallback() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) {
      navigate('/login', { replace: true })
      return
    }

    api.auth
      .token(code)
      .then(({ token, user }) => {
        login(token, user)
        navigate('/dashboard', { replace: true })
      })
      .catch(() => navigate('/login', { replace: true }))
  }, [login, navigate])

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <p className="text-slate-400">Signing you in…</p>
    </div>
  )
}
