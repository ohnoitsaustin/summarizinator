import { randomUUID } from 'crypto'
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { getProject, getSourceConnection, getUpdatesByProject, createUpdate, deleteUpdate, patchUpdateContent } from '../lib/dynamo'
import type { Event, AudienceMode } from '../types'
import { fetchEvents } from '../lib/adapters'
import { preprocessEvents } from '../lib/preprocessing'
import { generateUpdate } from '../lib/bedrock'
import { analyzeRisks } from '../lib/riskAnalysis'

function parseRawEvents(raw: string): Event[] {
  try {
    return JSON.parse(raw) as Event[]
  } catch {
    return []
  }
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

function getUserId(event: APIGatewayProxyEventV2): string | null {
  const ctx = event.requestContext as unknown as {
    authorizer?: { jwt?: { claims?: Record<string, unknown> } }
  }
  const sub = ctx.authorizer?.jwt?.claims?.sub
  return typeof sub === 'string' ? sub : null
}

function parseAudience(value: unknown): AudienceMode {
  if (value === 'product' || value === 'executive') return value
  return 'engineering'
}

async function getConnection(userId: string, source: 'github' | 'jira') {
  return getSourceConnection(userId, source)
}

async function handleGenerate(event: APIGatewayProxyEventV2, userId: string): Promise<APIGatewayProxyResultV2> {
  const body = JSON.parse(event.body ?? '{}') as {
    projectId?: string
    days?: number
    audience?: unknown
    context?: string
    hiddenIds?: string[]
    highlightedIds?: string[]
  }
  if (!body.projectId) return err(400, 'Missing projectId')

  const project = await getProject(userId, body.projectId)
  if (!project) return err(404, 'Project not found')

  const connection = await getConnection(userId, project.source)
  if (!connection) {
    const label = project.source === 'github' ? 'GitHub' : 'Jira'
    return err(400, `${label} not connected. Connect your ${label} account first.`)
  }

  const days = body.days ?? 7
  const audience = parseAudience(body.audience)
  const context = body.context?.trim() || undefined

  const rawEvents = await fetchEvents(project, connection, days)
  const hiddenSet = new Set(body.hiddenIds ?? [])
  const highlightedSet = new Set(body.highlightedIds ?? [])
  const events = preprocessEvents(rawEvents)
    .filter(e => !hiddenSet.has(e.id))
    .map(e => ({ ...e, highlighted: highlightedSet.has(e.id) || undefined }))
  const signals = analyzeRisks(events, context)
  const content = await generateUpdate(events, days, audience, context, signals)

  return ok({ content, events, audience, generationContext: context })
}

async function handleSaveUpdate(event: APIGatewayProxyEventV2, userId: string): Promise<APIGatewayProxyResultV2> {
  const body = JSON.parse(event.body ?? '{}') as {
    projectId?: string
    name?: string
    content?: string
    rawEvents?: string
    audience?: unknown
    context?: string
  }
  if (!body.projectId || !body.name?.trim() || body.content === undefined) {
    return err(400, 'Missing projectId, name, or content')
  }

  const project = await getProject(userId, body.projectId)
  if (!project) return err(404, 'Project not found')

  const update = {
    id: randomUUID(),
    projectId: project.id,
    name: body.name.trim(),
    content: body.content,
    rawEvents: body.rawEvents ?? '[]',
    createdAt: new Date().toISOString(),
    audience: parseAudience(body.audience),
    generationContext: body.context?.trim() || undefined,
  }
  await createUpdate(update)

  return ok({
    id: update.id,
    name: update.name,
    content: update.content,
    createdAt: update.createdAt,
    events: parseRawEvents(update.rawEvents),
    audience: update.audience,
    generationContext: update.generationContext,
  })
}

async function handleListUpdates(event: APIGatewayProxyEventV2, userId: string): Promise<APIGatewayProxyResultV2> {
  const projectId = event.pathParameters?.projectId
  if (!projectId) return err(400, 'Missing projectId')

  const project = await getProject(userId, projectId)
  if (!project) return err(404, 'Project not found')

  const updates = await getUpdatesByProject(projectId)
  return ok(updates.map(u => ({
    id: u.id,
    name: u.name ?? '',
    content: u.content,
    createdAt: u.createdAt,
    events: parseRawEvents(u.rawEvents),
    audience: u.audience ?? 'engineering',
    generationContext: u.generationContext,
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

  const project = await getProject(userId, projectId)
  if (!project) return err(404, 'Project not found')

  const connection = await getConnection(userId, project.source)
  if (!connection) {
    const label = project.source === 'github' ? 'GitHub' : 'Jira'
    return err(400, `${label} not connected. Connect your ${label} account first.`)
  }

  const rawEvents = await fetchEvents(project, connection, days)
  const events = preprocessEvents(rawEvents)
  return ok({ events, days })
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const userId = getUserId(event)
  if (!userId) return err(401, 'Unauthorized')

  try {
    const route = event.routeKey
    if (route === 'POST /api/updates/generate') return handleGenerate(event, userId)
    if (route === 'POST /api/updates/save') return handleSaveUpdate(event, userId)
    if (route === 'GET /api/projects/{projectId}/updates') return handleListUpdates(event, userId)
    if (route === 'GET /api/projects/{projectId}/events') return handleFetchEvents(event, userId)
    if (route === 'DELETE /api/updates/{id}') return handleDeleteUpdate(event, userId)
    if (route === 'PATCH /api/updates/{id}') return handlePatchUpdate(event, userId)
    return err(404, 'Not found')
  } catch (e) {
    console.error(e)
    return err(500, 'Internal server error')
  }
}
