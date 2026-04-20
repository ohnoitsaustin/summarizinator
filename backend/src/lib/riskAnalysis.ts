import type { Event } from '../types'

export type RiskSignals = {
  completedCount: number
  inProgressCount: number
  createdCount: number
  updatedCount: number
  blockedCount: number
  staleCount: number
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

function ageInDays(event: Event, now: Date): number {
  return (now.getTime() - new Date(event.createdAt).getTime()) / (1000 * 60 * 60 * 24)
}

function significantWords(title: string): string[] {
  return title.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(w => w.length > 3)
}

export function analyzeRisks(events: Event[], userContext?: string): RiskSignals {
  const now = new Date()

  const completed = events.filter(e => e.type === 'completed')
  const inProgress = events.filter(e => e.type === 'in_progress')
  const created = events.filter(e => e.type === 'created')
  const updated = events.filter(e => e.type === 'updated')
  const blocked = events.filter(e => e.type === 'blocked')

  const completedCount = completed.length
  const inProgressCount = inProgress.length
  const createdCount = created.length
  const updatedCount = updated.length
  const blockedCount = blocked.length

  const staleCount = [
    ...inProgress.filter(e => ageInDays(e, now) > STALE_DAYS),
    ...created.filter(e => ageInDays(e, now) > STALE_DAYS),
  ].length

  const hasReviewBottleneck = inProgressCount > 0 && (
    (completedCount === 0 && inProgressCount >= 2) ||
    (completedCount > 0 && inProgressCount / completedCount > 1.5) ||
    staleCount >= 2
  )

  const totalOpened = inProgressCount + createdCount
  const hasLowCompletionSignal = totalOpened > 3 && completedCount < totalOpened * 0.4

  const hasHighWorkInProgress = (inProgressCount + createdCount) > 4

  // Scope expansion: new work language AND more opened than closed
  const openTitles = [...created, ...inProgress].map(e => e.title.toLowerCase())
  const scopeKeywords = ['add', 'new', 'introduce', 'implement', 'feature', 'request']
  const hasPotentialScopeExpansion = (createdCount + inProgressCount) > completedCount
    && openTitles.some(t => scopeKeywords.some(kw => t.includes(kw)))

  // Fragmented execution: few repeated words across event titles
  const wordFreq = new Map<string, number>()
  for (const e of [...created, ...inProgress, ...completed]) {
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
  ) && (inProgressCount + createdCount) > 0

  const inferredRisks: string[] = []

  if (blockedCount > 0) {
    inferredRisks.push(`${blockedCount} item${blockedCount > 1 ? 's are' : ' is'} explicitly blocked, which may impact delivery.`)
  }
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

  const allEventText = events.map(e => `${e.title} ${e.description ?? ''}`).join(' ').toLowerCase()
  if (RISK_KEYWORDS.some(kw => allEventText.includes(kw))) {
    inferredRisks.push('Some activity references potential blockers, dependencies, or coordination needs.')
  }

  return {
    completedCount,
    inProgressCount,
    createdCount,
    updatedCount,
    blockedCount,
    staleCount,
    hasHighWorkInProgress,
    hasReviewBottleneck,
    hasLowCompletionSignal,
    hasPotentialScopeExpansion,
    hasFragmentedExecution,
    hasDeliveryCompressionRisk,
    inferredRisks,
  }
}
