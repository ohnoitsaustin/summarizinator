import type { GithubEvent } from '../types'

// TODO Phase 2: fetch PRs (merged + open), issues (closed + opened), commits
// Normalize each to GithubEvent and return the full list
export async function fetchRepoEvents(
  _token: string,
  _owner: string,
  _repo: string,
  _days: number,
): Promise<GithubEvent[]> {
  throw new Error('GitHub fetch not implemented yet — Phase 2')
}
