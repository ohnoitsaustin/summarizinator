import { randomUUID } from 'crypto'
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { getProjectsByUser, createProject, getProject, patchProject, getSourceConnection } from '../lib/dynamo'
import type { Project } from '../types'

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

  const method = event.requestContext.http.method

  try {
    if (method === 'GET') {
      const projects = await getProjectsByUser(userId)
      return ok(projects)
    }

    if (method === 'POST') {
      const body = JSON.parse(event.body ?? '{}') as {
        name?: string
        source?: string
        sourceConfig?: {
          repoOwner?: string
          repoName?: string
          jiraProjectKey?: string
        }
      }
      if (!body.name) return err(400, 'Missing required fields')

      const source = body.source === 'jira' ? 'jira' : 'github'

      if (source === 'github') {
        if (!body.sourceConfig?.repoOwner || !body.sourceConfig?.repoName) {
          return err(400, 'Missing repoOwner or repoName for GitHub project')
        }
      }

      if (source === 'jira') {
        if (!body.sourceConfig?.jiraProjectKey) {
          return err(400, 'Missing jiraProjectKey for Jira project')
        }
        // Resolve cloudId from the user's Jira connection
        const conn = await getSourceConnection(userId, 'jira')
        if (!conn) return err(400, 'Jira not connected. Connect your Jira account first.')
        if (!conn.jiraCloudId) return err(400, 'Jira connection missing cloudId')

        const project: Project = {
          id: randomUUID(),
          userId,
          name: body.name,
          source: 'jira',
          sourceConfig: {
            jiraProjectKey: body.sourceConfig.jiraProjectKey,
            jiraCloudId: conn.jiraCloudId,
          },
          createdAt: new Date().toISOString(),
        }
        await createProject(project)
        return ok(project, 201)
      }

      // GitHub
      const project: Project = {
        id: randomUUID(),
        userId,
        name: body.name,
        source: 'github',
        sourceConfig: {
          repoOwner: body.sourceConfig!.repoOwner,
          repoName: body.sourceConfig!.repoName,
        },
        createdAt: new Date().toISOString(),
      }
      await createProject(project)
      return ok(project, 201)
    }

    if (method === 'PATCH') {
      const projectId = event.pathParameters?.id
      if (!projectId) return err(400, 'Missing project id')
      const body = JSON.parse(event.body ?? '{}') as {
        name?: string
        sourceConfig?: Project['sourceConfig']
      }
      if (!body.name) return err(400, 'Missing name')
      const project = await getProject(userId, projectId)
      if (!project) return err(404, 'Project not found')
      const sourceConfig = body.sourceConfig ?? project.sourceConfig
      await patchProject(userId, projectId, { name: body.name, sourceConfig })
      return ok({ ...project, name: body.name, sourceConfig })
    }

    return err(405, 'Method not allowed')
  } catch (e) {
    console.error(e)
    return err(500, 'Internal server error')
  }
}
