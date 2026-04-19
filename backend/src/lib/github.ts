import type { GithubEvent } from '../types'

const BASE = 'https://api.github.com'

type GHPull = {
  title: string
  body: string | null
  user: { login: string }
  merged_at: string | null
  created_at: string
  html_url: string
}

type GHIssue = {
  title: string
  body: string | null
  user: { login: string }
  state: string
  created_at: string
  closed_at: string | null
  html_url: string
  pull_request?: unknown
}

type GHCommit = {
  commit: { message: string; author: { name: string; date: string } }
  html_url: string
  author: { login: string } | null
}

async function ghFetch(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'summarizinator',
    },
  })
  if (!res.ok) throw new Error(`GitHub API error ${res.status} for ${path}`)
  return res
}

async function fetchPRs(token: string, owner: string, repo: string, since: string): Promise<GithubEvent[]> {
  const [openRes, closedRes] = await Promise.all([
    ghFetch(`/repos/${owner}/${repo}/pulls?state=open&per_page=100`, token),
    ghFetch(`/repos/${owner}/${repo}/pulls?state=closed&per_page=100`, token),
  ])
  const [open, closed] = await Promise.all([
    openRes.json() as Promise<GHPull[]>,
    closedRes.json() as Promise<GHPull[]>,
  ])

  const events: GithubEvent[] = []
  for (const pr of open) {
    if (pr.created_at >= since) {
      events.push({ id: pr.html_url, type: 'pr_opened', title: pr.title, body: pr.body ?? undefined, author: pr.user.login, createdAt: pr.created_at, url: pr.html_url })
    }
  }
  for (const pr of closed) {
    if (pr.merged_at && pr.merged_at >= since) {
      events.push({ id: pr.html_url, type: 'pr_merged', title: pr.title, body: pr.body ?? undefined, author: pr.user.login, createdAt: pr.merged_at, url: pr.html_url })
    }
  }
  return events
}

async function fetchIssues(token: string, owner: string, repo: string, since: string): Promise<GithubEvent[]> {
  const res = await ghFetch(`/repos/${owner}/${repo}/issues?state=all&since=${since}&per_page=100`, token)
  const issues = await res.json() as GHIssue[]
  return issues
    .filter(i => !i.pull_request)
    .map(i => ({
      id: i.html_url,
      type: (i.state === 'closed' ? 'issue_closed' : 'issue_opened') as GithubEvent['type'],
      title: i.title,
      body: i.body ?? undefined,
      author: i.user.login,
      createdAt: (i.state === 'closed' ? i.closed_at : i.created_at) ?? i.created_at,
      url: i.html_url,
    }))
}

type GHRelease = {
  name: string | null
  tag_name: string
  body: string | null
  author: { login: string }
  published_at: string | null
  html_url: string
  draft: boolean
  prerelease: boolean
}

async function fetchReleases(token: string, owner: string, repo: string, since: string): Promise<GithubEvent[]> {
  const res = await ghFetch(`/repos/${owner}/${repo}/releases?per_page=100`, token)
  const releases = await res.json() as GHRelease[]
  return releases
    .filter(r => !r.draft && r.published_at && r.published_at >= since)
    .map(r => ({
      id: r.html_url,
      type: 'release' as const,
      title: r.name || r.tag_name,
      body: r.body ?? undefined,
      author: r.author.login,
      createdAt: r.published_at!,
      url: r.html_url,
    }))
}

async function fetchCommits(token: string, owner: string, repo: string, since: string): Promise<GithubEvent[]> {
  const res = await ghFetch(`/repos/${owner}/${repo}/commits?since=${since}&per_page=100`, token)
  const commits = await res.json() as GHCommit[]
  return commits.map(c => ({
    id: c.html_url,
    type: 'commit' as const,
    title: c.commit.message.split('\n')[0],
    author: c.author?.login ?? c.commit.author.name,
    createdAt: c.commit.author.date,
    url: c.html_url,
  }))
}

export async function fetchRepoEvents(
  token: string,
  owner: string,
  repo: string,
  days: number,
): Promise<GithubEvent[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const [releases, prs, issues, commits] = await Promise.all([
    fetchReleases(token, owner, repo, since),
    fetchPRs(token, owner, repo, since),
    fetchIssues(token, owner, repo, since),
    fetchCommits(token, owner, repo, since),
  ])
  return [...releases, ...prs, ...issues, ...commits]
}
