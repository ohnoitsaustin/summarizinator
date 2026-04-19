export type User = {
  id: string
  email: string
  githubLogin: string
  githubAccessToken: string
  githubTokenExpiry: string | null
  createdAt: string
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
