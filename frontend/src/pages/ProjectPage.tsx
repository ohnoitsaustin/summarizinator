import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type Project, type UpdateSummary } from '../api/client'
import GenerateButton from '../components/GenerateButton'
import UpdateEditor from '../components/UpdateEditor'
import CopyButton from '../components/CopyButton'

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [updates, setUpdates] = useState<UpdateSummary[]>([])
  const [activeContent, setActiveContent] = useState('')
  const [activeUpdateId, setActiveUpdateId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    api.projects.list().then(projects => {
      const found = projects.find(p => p.id === id) ?? null
      setProject(found)
    })
    api.updates.list(id).then(list => {
      setUpdates(list)
      if (list.length > 0) {
        setActiveContent(list[0].content)
        setActiveUpdateId(list[0].id)
      }
    })
  }, [id])

  async function handleGenerate() {
    if (!id) return
    setGenerating(true)
    setError(null)
    try {
      const result = await api.updates.generate(id)
      const newUpdate: UpdateSummary = { id: result.updateId, content: result.content, createdAt: new Date().toISOString() }
      setUpdates(prev => [newUpdate, ...prev])
      setActiveContent(result.content)
      setActiveUpdateId(result.updateId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handleRegenerate() {
    if (!id || !activeUpdateId) return
    setGenerating(true)
    setError(null)
    try {
      const result = await api.updates.regenerate(activeUpdateId, id)
      const newUpdate: UpdateSummary = { id: result.updateId, content: result.content, createdAt: new Date().toISOString() }
      setUpdates(prev => [newUpdate, ...prev])
      setActiveContent(result.content)
      setActiveUpdateId(result.updateId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Regeneration failed')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate('/dashboard')} className="text-slate-500 hover:text-white transition-colors">
          ← Back
        </button>
        <div>
          <h1 className="text-lg font-semibold">{project?.name ?? '…'}</h1>
          {project && (
            <p className="text-slate-500 text-sm">{project.repoOwner}/{project.repoName}</p>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex items-center gap-3">
          <GenerateButton onClick={handleGenerate} loading={generating} />
          {activeContent && (
            <>
              <button
                onClick={handleRegenerate}
                disabled={generating}
                className="px-4 py-2 border border-slate-700 hover:border-slate-500 disabled:opacity-50 rounded-lg text-sm transition-colors"
              >
                Regenerate
              </button>
              <CopyButton text={activeContent} />
            </>
          )}
        </div>

        {activeContent && (
          <UpdateEditor content={activeContent} onChange={setActiveContent} />
        )}

        {updates.length > 1 && (
          <div className="space-y-2">
            <p className="text-slate-500 text-sm">Past updates</p>
            {updates.slice(1).map(u => (
              <button
                key={u.id}
                onClick={() => { setActiveContent(u.content); setActiveUpdateId(u.id) }}
                className="w-full text-left px-4 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-sm text-slate-400 transition-colors"
              >
                {new Date(u.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
