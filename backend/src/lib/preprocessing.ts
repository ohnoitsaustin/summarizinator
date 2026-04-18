import type { GithubEvent } from '../types'

const NOISE = [/\btypo\b/i, /\blint\b/i, /\bformat(ting)?\b/i, /\bminor\b/i, /fix\s+whitespace/i]

export function preprocessEvents(events: GithubEvent[]): GithubEvent[] {
  const filtered = events.filter(e => {
    if (e.title.trim().split(/\s+/).length < 5) return false
    return !NOISE.some(p => p.test(e.title))
  })

  // Normalize title to a dedup key, preferring pr_merged over any other type
  const seen = new Map<string, GithubEvent>()
  for (const event of filtered) {
    const key = event.title.toLowerCase().replace(/[^a-z0-9]/g, '')
    const existing = seen.get(key)
    if (!existing || (event.type === 'pr_merged' && existing.type !== 'pr_merged')) {
      seen.set(key, event)
    }
  }

  return Array.from(seen.values())
}
