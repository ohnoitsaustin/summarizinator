import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID as string

export function initiateGitHubConnect() {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: `${window.location.origin}/connect/github/callback`,
    scope: 'read:user user:email repo',
  })
  window.location.href = `https://github.com/login/oauth/authorize?${params}`
}

export default function ConnectGitHub() {
  const navigate = useNavigate()
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) {
      navigate('/dashboard', { replace: true })
      return
    }

    api.connections
      .connectGitHub(code)
      .then(() => navigate('/dashboard', { replace: true }))
      .catch(() => navigate('/dashboard', { replace: true, state: { error: 'Failed to connect GitHub. Please try again.' } }))
  }, [navigate])

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <p className="text-brand-accent/70">Connecting GitHub…</p>
    </div>
  )
}
