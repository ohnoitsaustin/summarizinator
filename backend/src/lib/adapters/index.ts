import type { Event, Project, SourceConnection } from '../../types'
import { githubFetchEvents } from './github'
import { jiraFetchEvents, jiraRefreshToken } from './jira'
import { upsertSourceConnection } from '../dynamo'

async function maybeRefreshJira(conn: SourceConnection): Promise<SourceConnection> {
  if (!conn.expiresAt || !conn.refreshToken) return conn
  // Refresh if token expires within 5 minutes
  if (new Date(conn.expiresAt).getTime() - Date.now() > 5 * 60 * 1000) return conn
  const refreshed = await jiraRefreshToken(conn.refreshToken)
  const updated: SourceConnection = { ...conn, accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt }
  await upsertSourceConnection(updated)
  return updated
}

export async function fetchEvents(
  project: Project,
  connection: SourceConnection,
  days: number,
): Promise<Event[]> {
  if (project.source === 'github') {
    return githubFetchEvents(project, days, connection.accessToken)
  }
  if (project.source === 'jira') {
    const conn = await maybeRefreshJira(connection)
    const { events, freshConnection } = await jiraFetchEvents(project, conn, days)
    if (freshConnection) await upsertSourceConnection(freshConnection)
    return events
  }
  throw new Error(`Unknown source: ${(project as Project).source}`)
}
