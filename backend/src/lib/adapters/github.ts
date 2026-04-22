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

function mapGithubSourceType(type: GithubEvent['type']): string {
  switch (type) {
    case 'pr_opened':
    case 'pr_merged':    return 'pull_request'
    case 'commit':       return 'commit'
    case 'issue_opened':
    case 'issue_closed': return 'issue'
    case 'release':      return 'release'
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
    sourceType: mapGithubSourceType(e.type),
    title: e.title,
    description: e.body,
    actor: e.author,
    createdAt: e.createdAt,
    url: e.url,
  }))
}
