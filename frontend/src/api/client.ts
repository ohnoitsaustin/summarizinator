import { fetchAuthSession } from 'aws-amplify/auth'

async function getToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession()
    return session.tokens?.idToken?.toString() ?? null
  } catch {
    return null
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken()
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export type Project = {
  id: string
  name: string
  repoOwner: string
  repoName: string
  createdAt: string
}

export type AudienceMode = 'engineering' | 'product' | 'executive'

export type UpdateSummary = {
  id: string
  name: string
  content: string
  createdAt: string
  events: GithubEvent[]
  audience: AudienceMode
  generationContext?: string
}

export type GithubEvent = {
  id: string
  type: 'release' | 'pr_merged' | 'pr_opened' | 'issue_closed' | 'issue_opened' | 'commit'
  title: string
  body?: string
  author: string
  createdAt: string
  url: string
  highlighted?: boolean
}

type GenerateResult = {
  content: string
  events: GithubEvent[]
  audience: AudienceMode
  generationContext?: string
}

type Connection = {
  source: string
  connectedAt: string
  githubLogin?: string
}

export const api = {
  connections: {
    list: () => request<Connection[]>('/api/connections'),
    getGitHub: () => request<Connection>('/api/connections/github'),
    connectGitHub: (code: string) =>
      request<{ source: string; connected: boolean; githubLogin: string }>(
        '/api/connections/github',
        { method: 'POST', body: JSON.stringify({ code }) },
      ),
    disconnectGitHub: () =>
      request<{ disconnected: boolean }>('/api/connections/github', { method: 'DELETE' }),
  },
  projects: {
    list: () => request<Project[]>('/api/projects'),
    create: (data: { name: string; repoOwner: string; repoName: string }) =>
      request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
    patch: (id: string, data: { name: string; repoOwner: string; repoName: string }) =>
      request<Project>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  updates: {
    generate: (projectId: string, days = 7, audience: AudienceMode = 'engineering', context?: string, hiddenIds?: string[], highlightedIds?: string[]) =>
      request<GenerateResult>('/api/updates/generate', {
        method: 'POST',
        body: JSON.stringify({ projectId, days, audience, context, hiddenIds, highlightedIds }),
      }),
    save: (projectId: string, name: string, content: string, rawEvents: GithubEvent[], audience: AudienceMode, context?: string) =>
      request<UpdateSummary>('/api/updates/save', {
        method: 'POST',
        body: JSON.stringify({ projectId, name, content, rawEvents: JSON.stringify(rawEvents), audience, context }),
      }),
    list: (projectId: string) =>
      request<UpdateSummary[]>(`/api/projects/${projectId}/updates`),
    fetchEvents: (projectId: string, days: number) =>
      request<{ events: GithubEvent[]; days: number }>(`/api/projects/${projectId}/events?days=${days}`),
    delete: (updateId: string, projectId: string) =>
      request<{ deleted: boolean }>(`/api/updates/${updateId}`, {
        method: 'DELETE',
        body: JSON.stringify({ projectId }),
      }),
    patch: (updateId: string, projectId: string, content: string) =>
      request<{ updated: boolean }>(`/api/updates/${updateId}`, {
        method: 'PATCH',
        body: JSON.stringify({ projectId, content }),
      }),
  },
}
