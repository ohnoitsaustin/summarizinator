export type SourceConnection = {
  userId: string
  source: 'github' | 'jira'
  accessToken: string
  refreshToken?: string
  expiresAt?: string
  githubLogin?: string
  jiraCloudId?: string
  jiraDomain?: string
  connectedAt: string
}

export type Project = {
  id: string
  userId: string
  name: string
  repoOwner: string
  repoName: string
  createdAt: string
}

export type AudienceMode = 'engineering' | 'product' | 'executive'

export type Update = {
  id: string
  projectId: string
  name: string
  content: string
  rawEvents: string
  createdAt: string
  audience: AudienceMode
  generationContext?: string
}

export type GithubEvent = {
  id: string           // stable identifier (html_url)
  type: 'release' | 'pr_merged' | 'pr_opened' | 'issue_closed' | 'issue_opened' | 'commit'
  title: string
  body?: string
  author: string
  createdAt: string
  url: string
  highlighted?: boolean
}
