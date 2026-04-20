import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

const JIRA_CLIENT_ID = import.meta.env.VITE_JIRA_CLIENT_ID as string

export function initiateJiraConnect() {
  const redirectUri = `${window.location.origin}/connect/jira/callback`
  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: JIRA_CLIENT_ID,
    scope: 'read:jira-work read:jira-user offline_access',
    redirect_uri: redirectUri,
    response_type: 'code',
    prompt: 'consent',
  })
  window.location.href = `https://auth.atlassian.com/authorize?${params}`
}

export default function ConnectJira() {
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

    const redirectUri = `${window.location.origin}/connect/jira/callback`
    api.connections
      .connectJira(code, redirectUri)
      .then(() => navigate('/dashboard', { replace: true }))
      .catch(() => navigate('/dashboard', { replace: true, state: { error: 'Failed to connect Jira. Please try again.' } }))
  }, [navigate])

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <p className="text-brand-accent/70">Connecting Jira…</p>
    </div>
  )
}
