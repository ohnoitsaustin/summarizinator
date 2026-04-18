import { useParams, useNavigate } from 'react-router-dom'

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate('/dashboard')} className="text-slate-500 hover:text-white transition-colors">
          ← Back
        </button>
        <h1 className="text-lg font-semibold">Project</h1>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">
        <p className="text-slate-500">Project {id} — generate update coming in Phase 3.</p>
      </main>
    </div>
  )
}
