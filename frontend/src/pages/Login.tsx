import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID as string

export default function Login() {
  const { token } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (token) navigate('/dashboard', { replace: true })
  }, [token, navigate])

  function handleLogin() {
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      redirect_uri: `${window.location.origin}/auth/callback`,
      scope: 'read:user user:email repo',
    })
    window.location.href = `https://github.com/login/oauth/authorize?${params}`
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center space-y-6 max-w-md px-4">
        <h1 className="text-4xl font-bold text-white">Upward Status Generator</h1>
        <p className="text-slate-400 text-lg">
          Turn GitHub activity into executive-ready weekly updates in 30 seconds.
        </p>
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white text-slate-900 rounded-lg font-semibold hover:bg-slate-100 transition-colors"
        >
          <GitHubIcon />
          Continue with GitHub
        </button>
      </div>
    </div>
  )
}

function GitHubIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}
