import { randomUUID } from 'crypto'
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { getProjectsByUser, createProject, getProject, patchProject } from '../lib/dynamo'
import { verifyToken } from '../lib/jwt'

const ok = (body: unknown, status = 200): APIGatewayProxyResultV2 => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const err = (status: number, message: string): APIGatewayProxyResultV2 => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message }),
})

function getUser(event: APIGatewayProxyEventV2) {
  try {
    const header = event.headers.authorization ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    return verifyToken(token)
  } catch {
    return null
  }
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const user = getUser(event)
  if (!user) return err(401, 'Unauthorized')

  const method = event.requestContext.http.method

  try {
    if (method === 'GET') {
      const projects = await getProjectsByUser(user.sub)
      return ok(projects)
    }

    if (method === 'POST') {
      const body = JSON.parse(event.body ?? '{}') as {
        name?: string
        repoOwner?: string
        repoName?: string
      }
      if (!body.name || !body.repoOwner || !body.repoName) return err(400, 'Missing required fields')

      const project = {
        id: randomUUID(),
        userId: user.sub,
        name: body.name,
        repoOwner: body.repoOwner,
        repoName: body.repoName,
        createdAt: new Date().toISOString(),
      }
      await createProject(project)
      return ok(project, 201)
    }

    if (method === 'PATCH') {
      const projectId = event.pathParameters?.id
      if (!projectId) return err(400, 'Missing project id')
      const body = JSON.parse(event.body ?? '{}') as { name?: string; repoOwner?: string; repoName?: string }
      if (!body.name || !body.repoOwner || !body.repoName) return err(400, 'Missing required fields')
      const project = await getProject(user.sub, projectId)
      if (!project) return err(404, 'Project not found')
      await patchProject(user.sub, projectId, { name: body.name, repoOwner: body.repoOwner, repoName: body.repoName })
      return ok({ ...project, name: body.name, repoOwner: body.repoOwner, repoName: body.repoName })
    }

    return err(405, 'Method not allowed')
  } catch (e) {
    console.error(e)
    return err(500, 'Internal server error')
  }
}
