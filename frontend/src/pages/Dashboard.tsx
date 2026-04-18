import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api, type Project } from '../api/client'
import ProjectCard from '../components/ProjectCard'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', repoOwner: '', repoName: '' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.projects.list()
      .then(setProjects)
      .catch(() => setError('Failed to load projects'))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      const project = await api.projects.create(form)
      setProjects(p => [...p, project])
      setShowForm(false)
      setForm({ name: '', repoOwner: '', repoName: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-brand-bg text-white">
      <header className="border-b border-brand-mid/50 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Summarizinator</h1>
        <div className="flex items-center gap-4">
          <span className="text-brand-accent/70 text-sm">@{user?.githubLogin}</span>
          <button onClick={handleLogout} className="text-sm text-brand-mid hover:text-white transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Projects</h2>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-brand-accent hover:bg-brand-accent/80 rounded-lg text-sm font-medium transition-colors"
          >
            New Project
          </button>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {showForm && (
          <form onSubmit={handleCreate} className="bg-brand-surface rounded-xl p-6 space-y-4 border border-brand-mid/50">
            <h3 className="font-semibold">Add a project</h3>
            <div className="space-y-3">
              <input
                required
                placeholder="Project name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-brand-bg border border-brand-mid/50 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent placeholder:text-brand-mid"
              />
              <div className="flex gap-2">
                <input
                  required
                  placeholder="Owner (e.g. acme)"
                  value={form.repoOwner}
                  onChange={e => setForm(f => ({ ...f, repoOwner: e.target.value }))}
                  className="flex-1 bg-brand-bg border border-brand-mid/50 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent placeholder:text-brand-mid"
                />
                <input
                  required
                  placeholder="Repo (e.g. api)"
                  value={form.repoName}
                  onChange={e => setForm(f => ({ ...f, repoName: e.target.value }))}
                  className="flex-1 bg-brand-bg border border-brand-mid/50 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent placeholder:text-brand-mid"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 bg-brand-accent hover:bg-brand-accent/80 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-brand-mid hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-brand-mid">Loading…</p>
        ) : projects.length === 0 && !showForm ? (
          <p className="text-brand-mid">No projects yet. Add one to get started.</p>
        ) : (
          <div className="space-y-3">
            {projects.map(p => (
              <ProjectCard key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
