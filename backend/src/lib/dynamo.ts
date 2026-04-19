import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import type { User, Project, Update } from '../types'

const TABLE = process.env.DYNAMODB_TABLE_NAME!
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}))

export async function getUserById(id: string): Promise<User | null> {
  const res = await client.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `USER#${id}`, SK: '#METADATA' },
  }))
  return res.Item ? (res.Item as User) : null
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const res = await client.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': `EMAIL#${email}` },
    Limit: 1,
  }))
  return res.Items?.[0] ? (res.Items[0] as User) : null
}

export async function upsertUser(user: User): Promise<void> {
  await client.send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: `USER#${user.id}`,
      SK: '#METADATA',
      GSI1PK: `EMAIL#${user.email}`,
      GSI1SK: `USER#${user.id}`,
      ...user,
    },
  }))
}

export async function getProjectsByUser(userId: string): Promise<Project[]> {
  const res = await client.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':sk': 'PROJECT#' },
  }))
  return (res.Items ?? []) as Project[]
}

export async function getProject(userId: string, projectId: string): Promise<Project | null> {
  const res = await client.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `USER#${userId}`, SK: `PROJECT#${projectId}` },
  }))
  return res.Item ? (res.Item as Project) : null
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


export async function patchProject(userId: string, projectId: string, fields: { name: string; repoOwner: string; repoName: string }): Promise<void> {
  await client.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: `USER#${userId}`, SK: `PROJECT#${projectId}` },
    UpdateExpression: 'SET #name = :name, repoOwner = :repoOwner, repoName = :repoName',
    ExpressionAttributeNames: { '#name': 'name' },
    ExpressionAttributeValues: { ':name': fields.name, ':repoOwner': fields.repoOwner, ':repoName': fields.repoName },
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
