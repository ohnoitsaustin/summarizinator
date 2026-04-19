import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-brand-bg text-white flex flex-col">
      <header className="border-b border-brand-light/50 px-6 py-4 flex items-center justify-between shrink-0">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-lg font-semibold text-white hover:text-brand-accent transition-colors"
        >
          Summarizinator
        </button>
        <div className="flex items-center gap-4">
          <span className="text-brand-accent/70 text-sm">@{user?.githubLogin}</span>
          <button onClick={handleLogout} className="text-sm text-brand-light hover:text-white transition-colors">
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
