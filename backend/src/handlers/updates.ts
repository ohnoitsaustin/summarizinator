import { randomUUID } from 'crypto'
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { getProject, getUserById, getUpdatesByProject, getUpdateByProjectAndId, createUpdate, deleteUpdate, patchUpdateContent } from '../lib/dynamo'
import type { GithubEvent } from '../types'
import { verifyToken } from '../lib/jwt'
import { fetchRepoEvents } from '../lib/github'
import { preprocessEvents } from '../lib/preprocessing'
import { generateUpdate } from '../lib/bedrock'

function parseRawEvents(raw: string): GithubEvent[] {
  return (JSON.parse(raw) as GithubEvent[]).map(e => ({ ...e, id: e.id ?? e.url }))
}

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

async function handleGenerate(event: APIGatewayProxyEventV2, userId: string): Promise<APIGatewayProxyResultV2> {
  const body = JSON.parse(event.body ?? '{}') as { projectId?: string; days?: number }
  if (!body.projectId) return err(400, 'Missing projectId')

  const [project, user] = await Promise.all([
    getProject(userId, body.projectId),
    getUserById(userId),
  ])
  if (!project) return err(404, 'Project not found')
  if (!user) return err(404, 'User not found')

  const days = body.days ?? 7
  const rawEvents = await fetchRepoEvents(user.githubAccessToken, project.repoOwner, project.repoName, days)
  const events = preprocessEvents(rawEvents)

  const content = await generateUpdate(events, days)

  const update = {
    id: randomUUID(),
    projectId: project.id,
    content,
    rawEvents: JSON.stringify(events),
    createdAt: new Date().toISOString(),
  }
  await createUpdate(update)
  return ok({ updateId: update.id, content, events })
}

async function handleRegenerate(event: APIGatewayProxyEventV2, userId: string): Promise<APIGatewayProxyResultV2> {
  const updateId = event.pathParameters?.id
  const body = JSON.parse(event.body ?? '{}') as {
    projectId?: string
    hiddenIds?: string[]
    highlightedIds?: string[]
    days?: number
  }
  if (!updateId || !body.projectId) return err(400, 'Missing updateId or projectId')

  const project = await getProject(userId, body.projectId)
  if (!project) return err(404, 'Project not found')

  const existing = await getUpdateByProjectAndId(project.id, updateId)
  if (!existing) return err(404, 'Update not found')

  const hiddenSet = new Set(body.hiddenIds ?? [])
  const highlightedSet = new Set(body.highlightedIds ?? [])

  const events = (parseRawEvents(existing.rawEvents))
    .filter(e => !hiddenSet.has(e.id))
    .map(e => ({ ...e, highlighted: highlightedSet.has(e.id) || undefined }))

  const content = await generateUpdate(events, body.days ?? 7)

  const update = {
    id: randomUUID(),
    projectId: project.id,
    content,
    rawEvents: existing.rawEvents,
    createdAt: new Date().toISOString(),
  }
  await createUpdate(update)
  return ok({ updateId: update.id, content, events })
}

async function handleListUpdates(event: APIGatewayProxyEventV2, userId: string): Promise<APIGatewayProxyResultV2> {
  const projectId = event.pathParameters?.projectId
  if (!projectId) return err(400, 'Missing projectId')

  const project = await getProject(userId, projectId)
  if (!project) return err(404, 'Project not found')

  const updates = await getUpdatesByProject(projectId)
  return ok(updates.map(u => ({
    id: u.id,
    content: u.content,
    createdAt: u.createdAt,
    events: parseRawEvents(u.rawEvents),
  })))
}

async function handleDeleteUpdate(event: APIGatewayProxyEventV2, userId: string): Promise<APIGatewayProxyResultV2> {
  const updateId = event.pathParameters?.id
  const body = JSON.parse(event.body ?? '{}') as { projectId?: string }
  if (!updateId || !body.projectId) return err(400, 'Missing updateId or projectId')

  const project = await getProject(userId, body.projectId)
  if (!project) return err(404, 'Project not found')

  await deleteUpdate(project.id, updateId)
  return ok({ deleted: true })
}

async function handlePatchUpdate(event: APIGatewayProxyEventV2, userId: string): Promise<APIGatewayProxyResultV2> {
  const updateId = event.pathParameters?.id
  const body = JSON.parse(event.body ?? '{}') as { projectId?: string; content?: string }
  if (!updateId || !body.projectId || body.content === undefined) return err(400, 'Missing fields')

  const project = await getProject(userId, body.projectId)
  if (!project) return err(404, 'Project not found')

  await patchUpdateContent(project.id, updateId, body.content)
  return ok({ updated: true })
}

async function handleFetchEvents(event: APIGatewayProxyEventV2, userId: string): Promise<APIGatewayProxyResultV2> {
  const projectId = event.pathParameters?.projectId
  const days = parseInt(event.queryStringParameters?.days ?? '7', 10)
  if (!projectId) return err(400, 'Missing projectId')

  const [project, user] = await Promise.all([
    getProject(userId, projectId),
    getUserById(userId),
  ])
  if (!project) return err(404, 'Project not found')
  if (!user) return err(404, 'User not found')

  const rawEvents = await fetchRepoEvents(user.githubAccessToken, project.repoOwner, project.repoName, days)
  const events = preprocessEvents(rawEvents)
  return ok({ events, days })
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const user = getUser(event)
  if (!user) return err(401, 'Unauthorized')

  try {
    const route = event.routeKey
    if (route === 'POST /api/updates/generate') return handleGenerate(event, user.sub)
    if (route === 'POST /api/updates/{id}/regenerate') return handleRegenerate(event, user.sub)
    if (route === 'GET /api/projects/{projectId}/updates') return handleListUpdates(event, user.sub)
    if (route === 'GET /api/projects/{projectId}/events') return handleFetchEvents(event, user.sub)
    if (route === 'DELETE /api/updates/{id}') return handleDeleteUpdate(event, user.sub)
    if (route === 'PATCH /api/updates/{id}') return handlePatchUpdate(event, user.sub)
    return err(404, 'Not found')
  } catch (e) {
    console.error(e)
    return err(500, 'Internal server error')
  }
}
