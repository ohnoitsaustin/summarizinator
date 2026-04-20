import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import type { SourceConnection, Project, Update } from '../types'

const TABLE = process.env.DYNAMODB_TABLE_NAME!
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}))

// Normalize legacy DynamoDB records that have top-level repoOwner/repoName
function normalizeProject(item: Record<string, unknown>): Project {
  if (item.source) return item as Project
  return {
    ...(item as object),
    source: 'github',
    sourceConfig: {
      repoOwner: item.repoOwner as string | undefined,
      repoName: item.repoName as string | undefined,
    },
  } as Project
}

export async function getSourceConnection(userId: string, source: SourceConnection['source']): Promise<SourceConnection | null> {
  const res = await client.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `USER#${userId}`, SK: `CONNECTION#${source}` },
  }))
  return res.Item ? (res.Item as SourceConnection) : null
}

export async function listSourceConnections(userId: string): Promise<SourceConnection[]> {
  const res = await client.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':sk': 'CONNECTION#' },
  }))
  return (res.Items ?? []) as SourceConnection[]
}

export async function upsertSourceConnection(conn: SourceConnection): Promise<void> {
  await client.send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: `USER#${conn.userId}`,
      SK: `CONNECTION#${conn.source}`,
      ...conn,
    },
  }))
}

export async function deleteSourceConnection(userId: string, source: SourceConnection['source']): Promise<void> {
  await client.send(new DeleteCommand({
    TableName: TABLE,
    Key: { PK: `USER#${userId}`, SK: `CONNECTION#${source}` },
  }))
}

export async function getProjectsByUser(userId: string): Promise<Project[]> {
  const res = await client.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':sk': 'PROJECT#' },
  }))
  return (res.Items ?? []).map(item => normalizeProject(item as Record<string, unknown>))
}

export async function getProject(userId: string, projectId: string): Promise<Project | null> {
  const res = await client.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `USER#${userId}`, SK: `PROJECT#${projectId}` },
  }))
  return res.Item ? normalizeProject(res.Item as Record<string, unknown>) : null
}

export async function createProject(project: Project): Promise<void> {
  await client.send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: `USER#${project.userId}`,
      SK: `PROJECT#${project.id}`,
      ...project,
    },
  }))
}

export async function getUpdatesByProject(projectId: string): Promise<Update[]> {
  const res = await client.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: { ':pk': `PROJECT#${projectId}`, ':sk': 'UPDATE#' },
    ScanIndexForward: false,
  }))
  return (res.Items ?? []) as Update[]
}

export async function getUpdateByProjectAndId(projectId: string, updateId: string): Promise<Update | null> {
  const res = await client.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    FilterExpression: 'id = :id',
    ExpressionAttributeValues: {
      ':pk': `PROJECT#${projectId}`,
      ':sk': 'UPDATE#',
      ':id': updateId,
    },
  }))
  return res.Items?.[0] ? (res.Items[0] as Update) : null
}

export async function deleteUpdate(projectId: string, updateId: string): Promise<void> {
  const update = await getUpdateByProjectAndId(projectId, updateId)
  if (!update) return
  await client.send(new DeleteCommand({
    TableName: TABLE,
    Key: { PK: `PROJECT#${projectId}`, SK: `UPDATE#${update.createdAt}` },
  }))
}

export async function patchUpdateContent(projectId: string, updateId: string, content: string): Promise<void> {
  const update = await getUpdateByProjectAndId(projectId, updateId)
  if (!update) return
  await client.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: `PROJECT#${projectId}`, SK: `UPDATE#${update.createdAt}` },
    UpdateExpression: 'SET #content = :content',
    ExpressionAttributeNames: { '#content': 'content' },
    ExpressionAttributeValues: { ':content': content },
  }))
}

export async function patchProject(
  userId: string,
  projectId: string,
  fields: { name: string; sourceConfig: Project['sourceConfig'] },
): Promise<void> {
  await client.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: `USER#${userId}`, SK: `PROJECT#${projectId}` },
    UpdateExpression: 'SET #name = :name, sourceConfig = :sourceConfig',
    ExpressionAttributeNames: { '#name': 'name' },
    ExpressionAttributeValues: { ':name': fields.name, ':sourceConfig': fields.sourceConfig },
  }))
}

export async function createUpdate(update: Update): Promise<void> {
  await client.send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: `PROJECT#${update.projectId}`,
      SK: `UPDATE#${update.createdAt}`,
      ...update,
    },
  }))
}
