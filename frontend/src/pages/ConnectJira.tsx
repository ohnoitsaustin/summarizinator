import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

const JIRA_CLIENT_ID = import.meta.env.VITE_JIRA_CLIENT_ID as string

export function initiateJiraConnect() {
  const redirectUri = `${window.location.origin}/connect/jira/callback`
  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: JIRA_CLIENT_ID,
    scope: 'read:issue-details:jira read:field:jira read:field.default-value:jira read:field.option:jira read:group:jira read:project:jira offline_access',
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
      .catch(e => {
        console.error('Jira connect failed:', e)
        navigate('/dashboard', { replace: true, state: { jiraError: e instanceof Error ? e.message : 'Failed to connect Jira.' } })
      })
  }, [navigate])

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <p className="text-brand-accent/70">Connecting Jira…</p>
    </div>
  )
}
