import type { GithubEvent } from '../types'

export type RiskSignals = {
  mergedPrCount: number
  openPrCount: number
  openedIssueCount: number
  closedIssueCount: number
  commitCount: number
  staleOpenPrCount: number
  staleOpenIssueCount: number
  hasHighWorkInProgress: boolean
  hasReviewBottleneck: boolean
  hasLowCompletionSignal: boolean
  hasPotentialScopeExpansion: boolean
  hasFragmentedExecution: boolean
  hasDeliveryCompressionRisk: boolean
  inferredRisks: string[]
}

const RISK_KEYWORDS = ['blocked', 'waiting', 'approval', 'follow-up', 'refactor', 'urgent', 'hotfix', 'spike', 'support', 'investigate']
const STALE_DAYS = 3

function ageInDays(event: GithubEvent, now: Date): number {
  return (now.getTime() - new Date(event.createdAt).getTime()) / (1000 * 60 * 60 * 24)
}

function significantWords(title: string): string[] {
  return title.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(w => w.length > 3)
}

export function analyzeRisks(events: GithubEvent[], userContext?: string): RiskSignals {
  const now = new Date()

  const merged = events.filter(e => e.type === 'pr_merged')
  const openPrs = events.filter(e => e.type === 'pr_opened')
  const openedIssues = events.filter(e => e.type === 'issue_opened')
  const closedIssues = events.filter(e => e.type === 'issue_closed')
  const commits = events.filter(e => e.type === 'commit')

  const staleOpenPrCount = openPrs.filter(e => ageInDays(e, now) > STALE_DAYS).length
  const staleOpenIssueCount = openedIssues.filter(e => ageInDays(e, now) > STALE_DAYS).length

  const mergedPrCount = merged.length
  const openPrCount = openPrs.length
  const openedIssueCount = openedIssues.length
  const closedIssueCount = closedIssues.length
  const commitCount = commits.length

  const hasReviewBottleneck = openPrCount > 0 && (
    (mergedPrCount === 0 && openPrCount >= 2) ||
    (mergedPrCount > 0 && openPrCount / mergedPrCount > 1.5) ||
    staleOpenPrCount >= 2
  )

  const totalOpened = openPrCount + openedIssueCount
  const totalClosed = mergedPrCount + closedIssueCount
  const hasLowCompletionSignal = totalOpened > 3 && totalClosed < totalOpened * 0.4

  const hasHighWorkInProgress = (openPrCount + openedIssueCount) > 4

  // Scope expansion: new work language AND more opened than closed
  const allTitles = [...openedIssues, ...openPrs].map(e => e.title.toLowerCase())
  const scopeKeywords = ['add', 'new', 'introduce', 'implement', 'feature', 'request']
  const hasPotentialScopeExpansion = (openedIssueCount + openPrCount) > mergedPrCount + closedIssueCount
    && allTitles.some(t => scopeKeywords.some(kw => t.includes(kw)))

  // Fragmented execution: few repeated words across event titles
  const wordFreq = new Map<string, number>()
  for (const e of [...openedIssues, ...openPrs, ...merged]) {
    for (const w of significantWords(e.title)) {
      wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1)
    }
  }
  const repeatedWords = [...wordFreq.values()].filter(c => c > 1).length
  const hasFragmentedExecution = events.length > 5 && repeatedWords < 2

  const contextLower = (userContext ?? '').toLowerCase()
  const hasDeliveryCompressionRisk = (
    contextLower.includes('release') ||
    contextLower.includes('milestone') ||
    contextLower.includes('deadline') ||
    contextLower.includes('friday') ||
    contextLower.includes('launch')
  ) && (openPrCount + openedIssueCount) > 0

  const inferredRisks: string[] = []

  if (hasReviewBottleneck) {
    inferredRisks.push('Work appears to be accumulating in review, which may slow near-term delivery.')
  }
  if (hasLowCompletionSignal) {
    inferredRisks.push('There is strong activity, but limited visible completion this period.')
  }
  if (hasPotentialScopeExpansion) {
    inferredRisks.push('New work appears to have entered scope during the reporting window.')
  }
  if (hasFragmentedExecution) {
    inferredRisks.push('Work appears distributed across multiple threads, which may reduce delivery focus.')
  }
  if (hasDeliveryCompressionRisk) {
    inferredRisks.push('Delivery remains active near a known milestone, which may compress validation or review time.')
  }

  const allEventText = events.map(e => `${e.title} ${e.body ?? ''}`).join(' ').toLowerCase()
  if (RISK_KEYWORDS.some(kw => allEventText.includes(kw))) {
    inferredRisks.push('Some activity references potential blockers, dependencies, or coordination needs.')
  }

  return {
    mergedPrCount,
    openPrCount,
    openedIssueCount,
    closedIssueCount,
    commitCount,
    staleOpenPrCount,
    staleOpenIssueCount,
    hasHighWorkInProgress,
    hasReviewBottleneck,
    hasLowCompletionSignal,
    hasPotentialScopeExpansion,
    hasFragmentedExecution,
    hasDeliveryCompressionRisk,
    inferredRisks,
  }
}
