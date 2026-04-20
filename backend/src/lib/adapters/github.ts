import type { Event, GithubEvent, Project } from '../../types'
import { fetchRepoEvents } from '../github'

function mapGithubType(type: GithubEvent['type']): Event['type'] {
  switch (type) {
    case 'pr_merged': return 'completed'
    case 'release':   return 'completed'
    case 'issue_closed': return 'completed'
    case 'pr_opened': return 'in_progress'
    case 'issue_opened': return 'created'
    case 'commit':    return 'updated'
  }
}

export async function githubFetchEvents(project: Project, days: number, token: string): Promise<Event[]> {
  const { repoOwner, repoName } = project.sourceConfig
  if (!repoOwner || !repoName) throw new Error('GitHub project missing repoOwner/repoName')

  const raw = await fetchRepoEvents(token, repoOwner, repoName, days)
  return raw.map(e => ({
    id: e.id,
    source: 'github' as const,
    type: mapGithubType(e.type),
    title: e.title,
    description: e.body,
    actor: e.author,
    createdAt: e.createdAt,
    url: e.url,
  }))
}
