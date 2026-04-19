import { randomUUID } from 'crypto'
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { getUserByEmail, upsertUser } from '../lib/dynamo'
import { signToken } from '../lib/jwt'

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

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  try {
    const body = JSON.parse(event.body ?? '{}') as { code?: string }
    if (!body.code) return err(400, 'Missing code')

    console.log('client_id bytes:', JSON.stringify(GITHUB_CLIENT_ID))
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
    if (!tokenData.access_token) {
      console.error('GitHub token exchange failed:', tokenData)
      return err(401, 'GitHub authentication failed')
    }

    const [ghUser, emails] = await Promise.all([
      fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'summarizinator' },
      }).then(r => r.json()) as Promise<{ login: string }>,
      fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'summarizinator' },
      }).then(r => r.json()) as Promise<{ email: string; primary: boolean; verified: boolean }[]>,
    ])

    const primary = emails.find(e => e.primary && e.verified)
    if (!primary) return err(401, 'No verified primary email on GitHub account')

    const existing = await getUserByEmail(primary.email)
    const user = {
      id: existing?.id ?? randomUUID(),
      email: primary.email,
      githubLogin: ghUser.login,
      githubAccessToken: tokenData.access_token,
      githubTokenExpiry: null,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }
    await upsertUser(user)

    const token = signToken({ sub: user.id, email: user.email, githubLogin: user.githubLogin })
    return ok({ token, user: { id: user.id, email: user.email, githubLogin: user.githubLogin } })
  } catch (e) {
    console.error(e)
    return err(500, 'Internal server error')
  }
}
