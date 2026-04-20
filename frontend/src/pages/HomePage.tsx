import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function HomePage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true })
  }, [user, loading, navigate])

  function handleLogin() {
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-brand-bg text-white flex flex-col">
      <header className="px-8 py-5 flex items-center justify-between shrink-0">
        <span className="text-lg font-semibold tracking-tight">Summarizinator</span>
        <button
          onClick={handleLogin}
          className="text-sm text-brand-accent/70 hover:text-brand-accent transition-colors"
        >
          Sign in
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center py-20">
        <div className="space-y-6 max-w-2xl">
          <h1 className="text-5xl font-bold leading-tight tracking-tight">
            Engineering updates your<br />leadership will actually read.
          </h1>
          <p className="text-brand-accent/70 text-xl leading-relaxed">
            Connect a GitHub repo. Choose your audience. Get a clear, risk-aware update in seconds — no copy-pasting, no context switching.
          </p>
          <div className="pt-2">
            <button
              onClick={handleLogin}
              className="inline-flex items-center gap-3 px-8 py-4 bg-brand-cta text-brand-bg rounded-xl font-semibold text-base hover:bg-brand-cta/85 transition-colors"
            >
              Get started
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-3xl w-full mt-20 text-left">
          <FeatureCard
            title="Audience-aware"
            body="Choose Engineering, Product, or Executive framing. Language, emphasis, and detail level adjust automatically for who's reading."
          />
          <FeatureCard
            title="Context you control"
            body="Add release timing, staffing changes, or known blockers. The model treats your input as a strong signal, not an afterthought."
          />
          <FeatureCard
            title="Risks surfaced automatically"
            body="Detects review bottlenecks, scope drift, and delivery pressure even when nothing is explicitly labeled blocked."
          />
        </div>
      </main>

      <footer className="px-8 py-6 text-center text-brand-accent/30 text-xs shrink-0">
        Built on GitHub + Claude
      </footer>
    </div>
  )
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-brand-surface/30 border border-brand-accent/10 rounded-2xl p-6 space-y-2">
      <h3 className="font-semibold text-brand-accent">{title}</h3>
      <p className="text-brand-accent/60 text-sm leading-relaxed">{body}</p>
    </div>
  )
}

