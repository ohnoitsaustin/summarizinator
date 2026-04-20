import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AuthCallback() {
  const { refreshUser } = useAuth()
  const navigate = useNavigate()
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    // Amplify has already exchanged the OAuth code by the time this component mounts.
    // We just need to reload the user session and redirect.
    refreshUser()
      .then(() => navigate('/dashboard', { replace: true }))
      .catch(() => navigate('/login', { replace: true, state: { error: 'Sign-in failed. Please try again.' } }))
  }, [refreshUser, navigate])

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <p className="text-brand-accent/70">Signing you in…</p>
    </div>
  )
}
