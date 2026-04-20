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

// Internal type used only by the GitHub adapter
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
