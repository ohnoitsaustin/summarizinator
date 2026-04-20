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
  source: 'github' | 'jira'
  sourceConfig: {
    repoOwner?: string
    repoName?: string
    jiraProjectKey?: string
    jiraCloudId?: string
  }
  createdAt: string
}

export type AudienceMode = 'engineering' | 'product' | 'executive'

export type Event = {
  id: string
  source: 'github' | 'jira'
  type: 'completed' | 'created' | 'in_progress' | 'updated' | 'blocked'
  title: string
  description?: string
  actor?: string
  assignee?: string
  createdAt: string
  updatedAt?: string
  status?: string
  labels?: string[]
  url?: string
  highlighted?: boolean
}

export type UpdateSummary = {
  id: string
  name: string
  content: string
  createdAt: string
  events: Event[]
  audience: AudienceMode
  generationContext?: string
}

type GenerateResult = {
  content: string
  events: Event[]
  audience: AudienceMode
  generationContext?: string
}

type Connection = {
  source: string
  connectedAt: string
  githubLogin?: string
  jiraDomain?: string
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
    getJira: () => request<Connection>('/api/connections/jira'),
    connectJira: (code: string, redirectUri: string) =>
      request<{ source: string; connected: boolean; jiraDomain: string }>(
        '/api/connections/jira',
        { method: 'POST', body: JSON.stringify({ code, redirectUri }) },
      ),
    disconnectJira: () =>
      request<{ disconnected: boolean }>('/api/connections/jira', { method: 'DELETE' }),
  },
  projects: {
    list: () => request<Project[]>('/api/projects'),
    create: (data: { name: string; source: 'github' | 'jira'; sourceConfig: Project['sourceConfig'] }) =>
      request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
    patch: (id: string, data: { name: string; sourceConfig?: Project['sourceConfig'] }) =>
      request<Project>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  updates: {
    generate: (projectId: string, days = 7, audience: AudienceMode = 'engineering', context?: string, hiddenIds?: string[], highlightedIds?: string[]) =>
      request<GenerateResult>('/api/updates/generate', {
        method: 'POST',
        body: JSON.stringify({ projectId, days, audience, context, hiddenIds, highlightedIds }),
      }),
    save: (projectId: string, name: string, content: string, rawEvents: Event[], audience: AudienceMode, context?: string) =>
      request<UpdateSummary>('/api/updates/save', {
        method: 'POST',
        body: JSON.stringify({ projectId, name, content, rawEvents: JSON.stringify(rawEvents), audience, context }),
      }),
    list: (projectId: string) =>
      request<UpdateSummary[]>(`/api/projects/${projectId}/updates`),
    fetchEvents: (projectId: string, days: number) =>
      request<{ events: Event[]; days: number }>(`/api/projects/${projectId}/events?days=${days}`),
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
