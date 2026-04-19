import type { Project } from '../api/client'

export default function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-brand-surface hover:bg-brand-light/30 border border-brand-light/50 rounded-xl px-6 py-4 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-white">{project.name}</p>
          <p className="text-brand-accent/70 text-sm mt-0.5">{project.repoOwner}/{project.repoName}</p>
        </div>
        <span className="text-brand-light">→</span>
      </div>
    </button>
  )
}
