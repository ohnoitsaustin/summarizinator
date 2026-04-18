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

export type Update = {
  id: string
  projectId: string
  content: string
  rawEvents: string
  createdAt: string
}

export type GithubEvent = {
  type: 'pr_merged' | 'pr_opened' | 'issue_closed' | 'issue_opened' | 'commit'
  title: string
  body?: string
  author: string
  createdAt: string
  url?: string
}
