async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token')
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
  content: string
  createdAt: string
  events: GithubEvent[]
  audience: AudienceMode
  generationContext?: string
}

export type GithubEvent = {
  id: string
  type: 'pr_merged' | 'pr_opened' | 'issue_closed' | 'issue_opened' | 'commit'
  title: string
  body?: string
  author: string
  createdAt: string
  url: string
  highlighted?: boolean
}

type GenerateResult = {
  updateId: string
  content: string
  events: GithubEvent[]
  audience: AudienceMode
  generationContext?: string
}

export const api = {
  auth: {
    token: (code: string) =>
      request<{ token: string; user: { id: string; email: string; githubLogin: string } }>(
        '/api/auth/token',
        { method: 'POST', body: JSON.stringify({ code }) },
      ),
  },
  projects: {
    list: () => request<Project[]>('/api/projects'),
    create: (data: { name: string; repoOwner: string; repoName: string }) =>
      request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  },
  updates: {
    generate: (projectId: string, days = 7, audience: AudienceMode = 'engineering', context?: string) =>
      request<GenerateResult>('/api/updates/generate', {
        method: 'POST',
        body: JSON.stringify({ projectId, days, audience, context }),
      }),
    regenerate: (
      updateId: string,
      projectId: string,
      hiddenIds?: string[],
      highlightedIds?: string[],
      days?: number,
      audience?: AudienceMode,
      context?: string,
    ) =>
      request<GenerateResult>(`/api/updates/${updateId}/regenerate`, {
        method: 'POST',
        body: JSON.stringify({ projectId, hiddenIds, highlightedIds, days, audience, context }),
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
