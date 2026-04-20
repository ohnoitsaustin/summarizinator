import type { Event, Project, SourceConnection } from '../../types'

const JIRA_CLIENT_ID = process.env.JIRA_CLIENT_ID!
const JIRA_CLIENT_SECRET = process.env.JIRA_CLIENT_SECRET!

export async function jiraExchangeCode(code: string, redirectUri: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresAt: string
  cloudId: string
  domain: string
}> {
  const tokenRes = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: JIRA_CLIENT_ID,
      client_secret: JIRA_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  })
  if (!tokenRes.ok) throw new Error(`Jira token exchange failed: ${tokenRes.status}`)
  const tokens = await tokenRes.json() as { access_token: string; refresh_token: string; expires_in: number }

  const resourcesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' },
  })
  if (!resourcesRes.ok) throw new Error('Failed to get Jira accessible resources')
  const resources = await resourcesRes.json() as Array<{ id: string; url: string }>
  if (!resources.length) throw new Error('No Jira sites accessible')

  const site = resources[0]
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    cloudId: site.id,
    domain: site.url,
  }
}

export async function jiraRefreshToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: string }> {
  const res = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: JIRA_CLIENT_ID,
      client_secret: JIRA_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) throw new Error('Failed to refresh Jira token')
  const data = await res.json() as { access_token: string; expires_in: number }
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }
}

function mapJiraStatus(status: string): Event['type'] {
  const s = status.toLowerCase()
  if (s.includes('done') || s.includes('closed') || s.includes('resolved')) return 'completed'
  if (s.includes('progress')) return 'in_progress'
  if (s.includes('block')) return 'blocked'
  return 'created'
}

type JiraIssue = {
  key: string
  fields: {
    summary: string
    description?: unknown
    status: { name: string }
    assignee?: { displayName: string } | null
    creator?: { displayName: string } | null
    reporter?: { displayName: string } | null
    created: string
    updated: string
    labels?: string[]
  }
}

function extractText(description: unknown): string | undefined {
  if (!description) return undefined
  if (typeof description === 'string') return description
  // Atlassian Document Format
  const adf = description as { content?: Array<{ content?: Array<{ text?: string }> }> }
  const text = adf.content?.flatMap(b => b.content ?? []).map(c => c.text ?? '').join(' ').trim()
  return text || undefined
}

export async function jiraFetchEvents(project: Project, connection: SourceConnection, days: number): Promise<Event[]> {
  const { jiraProjectKey, jiraCloudId } = project.sourceConfig
  if (!jiraProjectKey || !jiraCloudId) throw new Error('Jira project missing jiraProjectKey or jiraCloudId')

  const jql = encodeURIComponent(`project = "${jiraProjectKey}" AND updated >= -${days}d ORDER BY updated DESC`)
  const fields = 'summary,description,status,assignee,creator,reporter,created,updated,labels'
  const url = `https://api.atlassian.com/ex/jira/${jiraCloudId}/rest/api/3/search?jql=${jql}&maxResults=100&fields=${fields}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${connection.accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Jira search failed: ${res.status}`)
  const data = await res.json() as { issues: JiraIssue[] }

  const domain = connection.jiraDomain ?? `https://atlassian.net`

  return data.issues.map(issue => ({
    id: issue.key,
    source: 'jira' as const,
    type: mapJiraStatus(issue.fields.status.name),
    title: issue.fields.summary,
    description: extractText(issue.fields.description),
    actor: issue.fields.creator?.displayName ?? issue.fields.reporter?.displayName,
    assignee: issue.fields.assignee?.displayName ?? undefined,
    createdAt: issue.fields.created,
    updatedAt: issue.fields.updated,
    status: issue.fields.status.name,
    labels: issue.fields.labels?.length ? issue.fields.labels : undefined,
    url: `${domain}/browse/${issue.key}`,
  }))
}
