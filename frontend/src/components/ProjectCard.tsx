import type { Project } from '../api/client'

function projectSubtitle(project: Project): string {
  if (project.source === 'jira') {
    return project.sourceConfig.jiraProjectKey ?? 'Jira'
  }
  const { repoOwner, repoName } = project.sourceConfig
  if (repoOwner && repoName) return `${repoOwner}/${repoName}`
  return ''
}

export default function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-brand-surface hover:bg-brand-light/30 border border-brand-light/50 rounded-xl px-6 py-4 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-white">{project.name}</p>
          <p className="text-brand-accent/70 text-sm mt-0.5">{projectSubtitle(project)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-brand-light/40 uppercase tracking-wide">{project.source}</span>
          <span className="text-brand-light">→</span>
        </div>
      </div>
    </button>
  )
}
