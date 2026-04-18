import type { GithubEvent } from '../types'

// TODO Phase 3: call Bedrock Claude 3.5 Sonnet with filtered events, return structured markdown
export async function generateUpdate(_events: GithubEvent[]): Promise<string> {
  throw new Error('Bedrock generation not implemented yet — Phase 3')
}
