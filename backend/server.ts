import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env.local') })

import http from 'http'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

const PORT = 3001

// Decode JWT payload without signature verification — local dev only
function decodeJwtClaims(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(Buffer.from(payload, 'base64url').toString())
  } catch {
    return null
  }
}

;(async () => {
  const { handler: connectionsHandler } = await import('./src/handlers/connections')
  const { handler: projectsHandler } = await import('./src/handlers/projects')
  const { handler: updatesHandler } = await import('./src/handlers/updates')

  type Handler = typeof connectionsHandler

  const ROUTES: Array<{ method: string; pattern: string; handler: Handler }> = [
    { method: 'GET',    pattern: '/api/connections',                  handler: connectionsHandler },
    { method: 'GET',    pattern: '/api/connections/github',           handler: connectionsHandler },
    { method: 'POST',   pattern: '/api/connections/github',           handler: connectionsHandler },
    { method: 'DELETE', pattern: '/api/connections/github',           handler: connectionsHandler },
    { method: 'GET',    pattern: '/api/projects',                     handler: projectsHandler },
    { method: 'POST',   pattern: '/api/projects',                     handler: projectsHandler },
    { method: 'PATCH',  pattern: '/api/projects/{id}',                handler: projectsHandler },
    { method: 'POST',   pattern: '/api/updates/generate',             handler: updatesHandler },
    { method: 'POST',   pattern: '/api/updates/save',                 handler: updatesHandler },
    { method: 'GET',    pattern: '/api/projects/{projectId}/updates', handler: updatesHandler },
    { method: 'GET',    pattern: '/api/projects/{projectId}/events',  handler: updatesHandler },
    { method: 'DELETE', pattern: '/api/updates/{id}',                 handler: updatesHandler },
    { method: 'PATCH',  pattern: '/api/updates/{id}',                 handler: updatesHandler },
  ]

  function matchRoute(method: string, path: string) {
    for (const route of ROUTES) {
      if (route.method !== method) continue
      const paramNames: string[] = []
      const regex = new RegExp(
        '^' + route.pattern.replace(/\{(\w+)\}/g, (_, n) => { paramNames.push(n); return '([^/]+)' }) + '$'
      )
      const m = path.match(regex)
      if (m) {
        const pathParameters: Record<string, string> = {}
        paramNames.forEach((n, i) => { pathParameters[n] = m[i + 1] })
        return { routeKey: `${method} ${route.pattern}`, handler: route.handler, pathParameters }
      }
    }
    return null
  }

  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
    const method = req.method ?? 'GET'

    if (method === 'OPTIONS') {
      res.writeHead(204, CORS)
      res.end()
      return
    }

    const body = await new Promise<string>(resolve => {
      const chunks: Buffer[] = []
      req.on('data', c => chunks.push(c))
      req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    })

    const matched = matchRoute(method, url.pathname)
    if (!matched) {
      res.writeHead(404, { 'Content-Type': 'application/json', ...CORS })
      res.end(JSON.stringify({ message: 'Not found' }))
      return
    }

    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers[k] = v
    }

    const authHeader = headers['authorization'] ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const claims = token ? decodeJwtClaims(token) : null

    const event = {
      routeKey: matched.routeKey,
      rawPath: url.pathname,
      rawQueryString: url.search.slice(1),
      headers,
      pathParameters: matched.pathParameters,
      queryStringParameters: Object.fromEntries(url.searchParams),
      body: body || undefined,
      isBase64Encoded: false,
      requestContext: {
        http: { method },
        ...(claims ? { authorizer: { jwt: { claims } } } : {}),
      },
    } as APIGatewayProxyEventV2

    try {
      const result = await matched.handler(event, {} as never, () => {})
      if (result && typeof result === 'object' && 'statusCode' in result) {
        res.writeHead(result.statusCode ?? 200, { 'Content-Type': 'application/json', ...CORS, ...result.headers })
        res.end(result.body ?? '')
      }
    } catch (e) {
      console.error(e)
      res.writeHead(500, { 'Content-Type': 'application/json', ...CORS })
      res.end(JSON.stringify({ message: 'Internal server error' }))
    }
  }).listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`)
  })
})()
