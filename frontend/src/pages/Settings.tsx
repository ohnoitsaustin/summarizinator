import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { initiateJiraConnect } from './ConnectJira'

type ConnectionStatus = {
  github: { connected: boolean; login?: string } | null
  jira: { connected: boolean; domain?: string } | null
}

export default function Settings() {
  const [status, setStatus] = useState<ConnectionStatus>({ github: null, jira: null })
  const [disconnecting, setDisconnecting] = useState<'github' | 'jira' | null>(null)

  useEffect(() => {
    api.connections.getGitHub()
      .then(c => setStatus(s => ({ ...s, github: { connected: true, login: c.githubLogin } })))
      .catch(() => setStatus(s => ({ ...s, github: { connected: false } })))
    api.connections.getJira()
      .then(c => setStatus(s => ({ ...s, jira: { connected: true, domain: c.jiraDomain } })))
      .catch(() => setStatus(s => ({ ...s, jira: { connected: false } })))
  }, [])

  async function disconnect(source: 'github' | 'jira') {
    setDisconnecting(source)
    try {
      if (source === 'github') {
        await api.connections.disconnectGitHub()
        setStatus(s => ({ ...s, github: { connected: false } }))
      } else {
        await api.connections.disconnectJira()
        setStatus(s => ({ ...s, jira: { connected: false } }))
      }
    } finally {
      setDisconnecting(null)
    }
  }

  function connectGitHub() {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID as string
    const redirectUri = `${window.location.origin}/connect/github/callback`
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, scope: 'repo read:user' })
    window.location.href = `https://github.com/login/oauth/authorize?${params}`
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <h2 className="text-2xl font-bold">Settings</h2>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-brand-accent/60 uppercase tracking-wider">Connected Accounts</h3>
        <div className="bg-brand-surface rounded-xl divide-y divide-brand-light/20 border border-brand-light/30">
          <ConnectionRow
            label="GitHub"
            detail={status.github?.login ? `@${status.github.login}` : undefined}
            connected={status.github?.connected ?? null}
            onConnect={connectGitHub}
            onDisconnect={() => disconnect('github')}
            disconnecting={disconnecting === 'github'}
          />
          <ConnectionRow
            label="Jira"
            detail={status.jira?.domain}
            connected={status.jira?.connected ?? null}
            onConnect={initiateJiraConnect}
            onDisconnect={() => disconnect('jira')}
            disconnecting={disconnecting === 'jira'}
          />
        </div>
      </section>
    </div>
  )
}

function ConnectionRow({
  label, detail, connected, onConnect, onDisconnect, disconnecting,
}: {
  label: string
  detail?: string
  connected: boolean | null
  onConnect: () => void
  onDisconnect: () => void
  disconnecting: boolean
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {connected === null ? (
          <p className="text-xs text-brand-accent/40 mt-0.5">Loading…</p>
        ) : connected && detail ? (
          <p className="text-xs text-brand-accent/60 mt-0.5">{detail}</p>
        ) : connected ? (
          <p className="text-xs text-green-400/70 mt-0.5">Connected</p>
        ) : (
          <p className="text-xs text-brand-accent/40 mt-0.5">Not connected</p>
        )}
      </div>
      {connected === null ? null : connected ? (
        <button
          onClick={onDisconnect}
          disabled={disconnecting}
          className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-300/50 rounded-lg transition-colors disabled:opacity-50"
        >
          {disconnecting ? 'Disconnecting…' : 'Disconnect'}
        </button>
      ) : (
        <button
          onClick={onConnect}
          className="px-3 py-1.5 text-xs bg-brand-cta text-brand-bg font-medium rounded-lg hover:bg-brand-cta/90 transition-colors"
        >
          Connect
        </button>
      )}
    </div>
  )
}
