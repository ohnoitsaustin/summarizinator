import type { Project } from '../api/client'

export default function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl px-6 py-4 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{project.name}</p>
          <p className="text-slate-500 text-sm mt-0.5">{project.repoOwner}/{project.repoName}</p>
        </div>
        <span className="text-slate-600">→</span>
      </div>
    </button>
  )
}
