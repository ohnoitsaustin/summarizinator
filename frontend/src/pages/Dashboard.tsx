import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api, type Project } from '../api/client'
import { initiateJiraConnect } from './ConnectJira'
import ProjectCard from '../components/ProjectCard'
import LoadingDots from '../components/LoadingDots'

const ORDER_KEY = 'project-order'

function applyStoredOrder(projects: Project[]): Project[] {
  try {
    const order: string[] = JSON.parse(localStorage.getItem(ORDER_KEY) ?? '[]')
    if (!order.length) return projects
    const map = new Map(projects.map(p => [p.id, p]))
    const sorted = order.filter(id => map.has(id)).map(id => map.get(id)!)
    const unseen = projects.filter(p => !order.includes(p.id))
    return [...unseen, ...sorted]
  } catch {
    return projects
  }
}

function saveOrder(projects: Project[]) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(projects.map(p => p.id)))
}

type CreateForm = {
  name: string
  source: 'github' | 'jira'
  repoOwner: string
  repoName: string
  jiraProjectKey: string
}

type EditForm = {
  name: string
  repoOwner: string
  repoName: string
  jiraProjectKey: string
}

export default function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateForm>({ name: '', source: 'github', repoOwner: '', repoName: '', jiraProjectKey: '' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>((location.state as { jiraError?: string } | null)?.jiraError ?? null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ name: '', repoOwner: '', repoName: '', jiraProjectKey: '' })
  const [saving, setSaving] = useState(false)
  const [jiraConnected, setJiraConnected] = useState<boolean | null>(null)
  const [jiraProjects, setJiraProjects] = useState<Array<{ key: string; name: string }> | null>(null)

  useEffect(() => {
    api.projects.list()
      .then(list => setProjects(applyStoredOrder(list)))
      .catch(() => setError('Failed to load projects'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (form.source !== 'jira' || jiraConnected !== null) return
    api.connections.getJira()
      .then(() => {
        setJiraConnected(true)
        api.connections.getJiraProjects()
          .then(projects => setJiraProjects(projects))
          .catch(() => setJiraProjects([]))
      })
      .catch(() => setJiraConnected(false))
  }, [form.source, jiraConnected])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      const sourceConfig = form.source === 'jira'
        ? { jiraProjectKey: form.jiraProjectKey }
        : { repoOwner: form.repoOwner, repoName: form.repoName }
      const project = await api.projects.create({ name: form.name, source: form.source, sourceConfig })
      setProjects(p => {
        const next = [project, ...p]
        saveOrder(next)
        return next
      })
      setShowForm(false)
      setForm({ name: '', source: 'github', repoOwner: '', repoName: '', jiraProjectKey: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  function startEdit(p: Project) {
    setEditingId(p.id)
    setEditForm({
      name: p.name,
      repoOwner: p.sourceConfig.repoOwner ?? '',
      repoName: p.sourceConfig.repoName ?? '',
      jiraProjectKey: p.sourceConfig.jiraProjectKey ?? '',
    })
  }

  async function handleSaveEdit(e: React.FormEvent, project: Project) {
    e.preventDefault()
    if (!editingId) return
    setSaving(true)
    try {
      const sourceConfig = project.source === 'jira'
        ? { jiraProjectKey: editForm.jiraProjectKey, jiraCloudId: project.sourceConfig.jiraCloudId }
        : { repoOwner: editForm.repoOwner, repoName: editForm.repoName }
      const updated = await api.projects.patch(editingId, { name: editForm.name, sourceConfig })
      setProjects(prev => prev.map(p => p.id === editingId ? updated : p))
      setEditingId(null)
    } catch {
      setError('Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const insert = e.clientY < rect.top + rect.height / 2 ? index : index + 1
    setDropIndex(insert)
  }

  function handleDrop() {
    if (draggedId === null || dropIndex === null) return
    setProjects(prev => {
      const from = prev.findIndex(p => p.id === draggedId)
      if (from === -1) return prev
      const adjusted = dropIndex > from ? dropIndex - 1 : dropIndex
      if (adjusted === from) return prev
      const next = [...prev]
      next.splice(from, 1)
      next.splice(adjusted, 0, prev[from])
      saveOrder(next)
      return next
    })
    setDraggedId(null)
    setDropIndex(null)
  }

  function handleDragEnd() {
    setDraggedId(null)
    setDropIndex(null)
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Projects</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-brand-accent hover:bg-brand-accent/80 text-brand-bg rounded-lg text-sm font-medium transition-colors"
        >
          New Project
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-brand-surface rounded-xl p-6 space-y-4 border border-brand-light/50">
          <h3 className="font-semibold">Add a project</h3>
          <div className="space-y-3">
            <input
              required
              placeholder="Project name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-brand-bg border border-brand-light/50 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent placeholder:text-brand-light"
            />
            {/* Source selector */}
            <div className="flex rounded-lg overflow-hidden border border-brand-light/30 text-sm">
              {(['github', 'jira'] as const).map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => {
                    setForm(f => ({ ...f, source: src }))
                    if (src === 'jira') { setJiraConnected(null); setJiraProjects(null) }
                  }}
                  className={`flex-1 py-2 transition-colors capitalize ${form.source === src ? 'bg-brand-cta text-brand-bg font-medium' : 'text-brand-accent/70 hover:text-white'} ${i > 0 ? 'border-l border-brand-light/30' : ''}`}
                >
                  {src === 'github' ? 'GitHub' : 'Jira'}
                </button>
              ))}
            </div>
            {form.source === 'github' ? (
              <div className="flex gap-2">
                <input
                  required
                  placeholder="Owner (e.g. acme)"
                  value={form.repoOwner}
                  onChange={e => setForm(f => ({ ...f, repoOwner: e.target.value }))}
                  onPaste={e => {
                    const text = e.clipboardData.getData('text')
                    if (!text.includes('/')) return
                    e.preventDefault()
                    const slash = text.indexOf('/')
                    const owner = text.slice(0, slash).trim()
                    const repo = text.slice(slash + 1).trim()
                    setForm(f => ({ ...f, repoOwner: owner, repoName: repo, name: f.name || repo }))
                  }}
                  className="flex-1 bg-brand-bg border border-brand-light/50 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent placeholder:text-brand-light"
                />
                <input
                  required
                  placeholder="Repo (e.g. api)"
                  value={form.repoName}
                  onChange={e => setForm(f => ({ ...f, repoName: e.target.value, name: f.name || e.target.value }))}
                  className="flex-1 bg-brand-bg border border-brand-light/50 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent placeholder:text-brand-light"
                />
              </div>
            ) : jiraConnected === false ? (
              <div className="flex items-center gap-3 px-4 py-3 bg-brand-bg border border-brand-light/30 rounded-lg">
                <span className="text-sm text-brand-accent/60 flex-1">Connect your Jira account first</span>
                <button
                  type="button"
                  onClick={initiateJiraConnect}
                  className="px-3 py-1.5 bg-brand-cta text-brand-bg text-xs font-medium rounded hover:bg-brand-cta/90 transition-colors"
                >
                  Connect Jira
                </button>
              </div>
            ) : jiraProjects === null ? (
              <div className="px-4 py-2 text-sm text-brand-accent/50">Loading projects…</div>
            ) : jiraProjects.length > 0 ? (
              <select
                required
                value={form.jiraProjectKey}
                onChange={e => {
                  const selected = jiraProjects.find(p => p.key === e.target.value)
                  setForm(f => ({ ...f, jiraProjectKey: e.target.value, name: f.name || selected?.name || e.target.value }))
                }}
                className="w-full bg-brand-bg border border-brand-light/50 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent text-brand-accent"
              >
                <option value="" disabled>Select a project</option>
                {jiraProjects.map(p => (
                  <option key={p.key} value={p.key}>{p.name} ({p.key})</option>
                ))}
              </select>
            ) : (
              <div className="space-y-1">
                <input
                  required
                  placeholder="Project key (e.g. ENG)"
                  value={form.jiraProjectKey}
                  onChange={e => setForm(f => ({ ...f, jiraProjectKey: e.target.value.toUpperCase(), name: f.name || e.target.value }))}
                  className="w-full bg-brand-bg border border-brand-light/50 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent placeholder:text-brand-light"
                />
                <p className="text-xs text-brand-accent/40 px-1">No projects found via API — enter the key manually. Check the browser console for details.</p>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating || (form.source === 'jira' && jiraConnected !== true)}
              className="px-4 py-2 bg-brand-accent hover:bg-brand-accent/80 disabled:opacity-50 rounded-lg text-sm text-brand-bg font-medium transition-colors"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-brand-light hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-brand-light"><LoadingDots /></p>
      ) : projects.length === 0 && !showForm ? (
        <p className="text-brand-light">No projects yet. Add one to get started.</p>
      ) : (
        <div onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropIndex(null) }}>
          {projects.map((p, i) => (
            <div key={p.id}>
              <div className={`h-0.5 rounded-full my-1.5 transition-colors ${dropIndex === i && draggedId !== p.id ? 'bg-brand-accent' : 'bg-transparent'}`} />
              {editingId === p.id ? (
                <form onSubmit={e => handleSaveEdit(e, p)} className="bg-brand-surface border border-brand-light/50 rounded-xl px-6 py-4 space-y-3">
                  <input
                    required autoFocus
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Project name"
                    className="w-full bg-brand-bg border border-brand-light/50 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent placeholder:text-brand-light"
                  />
                  {p.source === 'github' ? (
                    <div className="flex gap-2">
                      <input
                        required
                        value={editForm.repoOwner}
                        onChange={e => setEditForm(f => ({ ...f, repoOwner: e.target.value }))}
                        placeholder="Owner"
                        className="flex-1 bg-brand-bg border border-brand-light/50 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent placeholder:text-brand-light"
                      />
                      <input
                        required
                        value={editForm.repoName}
                        onChange={e => setEditForm(f => ({ ...f, repoName: e.target.value }))}
                        placeholder="Repo"
                        className="flex-1 bg-brand-bg border border-brand-light/50 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent placeholder:text-brand-light"
                      />
                    </div>
                  ) : (
                    <input
                      required
                      value={editForm.jiraProjectKey}
                      onChange={e => setEditForm(f => ({ ...f, jiraProjectKey: e.target.value.toUpperCase() }))}
                      placeholder="Jira project key"
                      className="w-full bg-brand-bg border border-brand-light/50 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent placeholder:text-brand-light"
                    />
                  )}
                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} className="px-3 py-1.5 bg-brand-accent hover:bg-brand-accent/80 disabled:opacity-50 rounded-lg text-xs text-brand-bg font-medium transition-colors">
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1.5 text-brand-light hover:text-white text-xs transition-colors">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div
                  draggable
                  onDragStart={e => handleDragStart(e, p.id)}
                  onDragOver={e => handleDragOver(e, i)}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 group transition-opacity ${draggedId === p.id ? 'opacity-40' : 'opacity-100'}`}
                >
                  <div className="shrink-0 cursor-grab active:cursor-grabbing text-brand-light/30 group-hover:text-brand-light/60 transition-colors px-1 select-none">
                    ⠿
                  </div>
                  <div className="flex-1">
                    <ProjectCard project={p} onClick={() => navigate(`/projects/${p.id}`)} />
                  </div>
                  <button
                    onClick={() => startEdit(p)}
                    className="shrink-0 px-1 text-brand-light/30 hover:text-brand-light transition-colors text-sm"
                    title="Edit project"
                  >
                    ✎
                  </button>
                </div>
              )}
            </div>
          ))}
          <div className={`h-0.5 rounded-full mt-1.5 transition-colors ${dropIndex === projects.length ? 'bg-brand-accent' : 'bg-transparent'}`} />
        </div>
      )}
    </div>
  )
}
