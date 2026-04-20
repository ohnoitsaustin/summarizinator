import type { Event } from '../types'

const NOISE = [/\btypo\b/i, /\blint\b/i, /\bformat(ting)?\b/i, /\bminor\b/i, /fix\s+whitespace/i]

export function preprocessEvents(events: Event[]): Event[] {
  const filtered = events.filter(e => !NOISE.some(p => p.test(e.title)))

  // Deduplicate by normalized title, preferring 'completed' events
  const seen = new Map<string, Event>()
  for (const event of filtered) {
    const key = event.title.toLowerCase().replace(/[^a-z0-9]/g, '')
    const existing = seen.get(key)
    const preferred = event.type === 'completed'
    const existingPreferred = existing?.type === 'completed'
    if (!existing || (preferred && !existingPreferred)) {
      seen.set(key, event)
    }
  }

  return Array.from(seen.values())
}
