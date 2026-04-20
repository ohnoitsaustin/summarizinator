import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { getSourceConnection, listSourceConnections, upsertSourceConnection, deleteSourceConnection } from '../lib/dynamo'
import { jiraExchangeCode } from '../lib/adapters/jira'

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!

const ok = (body: unknown): APIGatewayProxyResultV2 => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const err = (status: number, message: string): APIGatewayProxyResultV2 => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message }),
})

function getUserId(event: APIGatewayProxyEventV2): string | null {
  const ctx = event.requestContext as unknown as {
    authorizer?: { jwt?: { claims?: Record<string, unknown> } }
  }
  const sub = ctx.authorizer?.jwt?.claims?.sub
  return typeof sub === 'string' ? sub : null
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const userId = getUserId(event)
  if (!userId) return err(401, 'Unauthorized')

  const route = event.routeKey

  try {
    if (route === 'GET /api/connections') {
      const connections = await listSourceConnections(userId)
      return ok(connections.map(c => ({
        source: c.source,
        connectedAt: c.connectedAt,
        githubLogin: c.githubLogin,
        jiraDomain: c.jiraDomain,
      })))
    }

    // ── GitHub ───────────────────────────────────────────────────────────────

    if (route === 'GET /api/connections/github') {
      const conn = await getSourceConnection(userId, 'github')
      if (!conn) return err(404, 'GitHub not connected')
      return ok({ source: 'github', connectedAt: conn.connectedAt, githubLogin: conn.githubLogin })
    }

    if (route === 'POST /api/connections/github') {
      const body = JSON.parse(event.body ?? '{}') as { code?: string }
      if (!body.code) return err(400, 'Missing code')

      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code: body.code,
        }),
      })
      const tokenData = await tokenRes.json() as { access_token?: string }
      if (!tokenData.access_token) return err(401, 'GitHub authentication failed')

      const ghUser = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'summarizinator' },
      }).then(r => r.json()) as { login: string }

      await upsertSourceConnection({
        userId,
        source: 'github',
        accessToken: tokenData.access_token,
        githubLogin: ghUser.login,
        connectedAt: new Date().toISOString(),
      })

      return ok({ source: 'github', connected: true, githubLogin: ghUser.login })
    }

    if (route === 'DELETE /api/connections/github') {
      await deleteSourceConnection(userId, 'github')
      return ok({ disconnected: true })
    }

    // ── Jira ─────────────────────────────────────────────────────────────────

    if (route === 'GET /api/connections/jira') {
      const conn = await getSourceConnection(userId, 'jira')
      if (!conn) return err(404, 'Jira not connected')
      return ok({ source: 'jira', connectedAt: conn.connectedAt, jiraDomain: conn.jiraDomain })
    }

    if (route === 'POST /api/connections/jira') {
      const body = JSON.parse(event.body ?? '{}') as { code?: string; redirectUri?: string }
      if (!body.code || !body.redirectUri) return err(400, 'Missing code or redirectUri')

      const data = await jiraExchangeCode(body.code, body.redirectUri)

      await upsertSourceConnection({
        userId,
        source: 'jira',
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
        jiraCloudId: data.cloudId,
        jiraDomain: data.domain,
        connectedAt: new Date().toISOString(),
      })

      return ok({ source: 'jira', connected: true, jiraDomain: data.domain })
    }

    if (route === 'DELETE /api/connections/jira') {
      await deleteSourceConnection(userId, 'jira')
      return ok({ disconnected: true })
    }

    return err(404, 'Not found')
  } catch (e) {
    console.error(e)
    return err(500, 'Internal server error')
  }
}
