#!/usr/bin/env node
/**
 * Seed a Jira project with realistic-looking software engineering issues.
 *
 * Usage:
 *   JIRA_DOMAIN=yoursite.atlassian.net \
 *   JIRA_EMAIL=you@example.com \
 *   JIRA_API_TOKEN=your_token \
 *   JIRA_PROJECT_KEY=ENG \
 *   node scripts/seed-jira.mjs
 *
 * Get an API token at: https://id.atlassian.com/manage-api-tokens
 */

const DOMAIN = process.env.JIRA_DOMAIN
const EMAIL = process.env.JIRA_EMAIL
const TOKEN = process.env.JIRA_API_TOKEN
const PROJECT = process.env.JIRA_PROJECT_KEY

if (!DOMAIN || !EMAIL || !TOKEN || !PROJECT) {
  console.error('Missing required env vars: JIRA_DOMAIN, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY')
  process.exit(1)
}

const base = `https://${DOMAIN}`
const auth = Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64')
const headers = {
  Authorization: `Basic ${auth}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
}

const issues = [
  // Completed work
  { summary: 'Migrate authentication to JWT tokens', type: 'Story', status: 'Done', description: 'Replace session-based auth with stateless JWT tokens across all API endpoints. Includes refresh token rotation.' },
  { summary: 'Fix memory leak in event processing pipeline', type: 'Bug', status: 'Done', description: 'Event listeners were not being cleaned up on component unmount, causing gradual memory growth over long sessions.' },
  { summary: 'Add pagination to project list endpoint', type: 'Story', status: 'Done', description: 'API was returning all projects in a single response. Added cursor-based pagination with a default page size of 25.' },
  { summary: 'Upgrade Node.js runtime to v20', type: 'Task', status: 'Done', description: 'Updated all Lambda functions and local dev environment to Node.js 20 LTS.' },
  { summary: 'Implement rate limiting on public API routes', type: 'Story', status: 'Done', description: 'Added per-user rate limiting using a sliding window algorithm. Limits: 100 req/min for standard, 500 req/min for premium.' },
  { summary: 'Write integration tests for billing webhook handler', type: 'Task', status: 'Done', description: 'Added end-to-end tests covering subscription creation, upgrade, downgrade, and cancellation events.' },

  // In progress
  { summary: 'Build dashboard analytics charts', type: 'Story', status: 'In Progress', description: 'Add time-series charts showing key metrics: DAU, API calls, error rates. Using recharts library.' },
  { summary: 'Refactor database connection pooling', type: 'Task', status: 'In Progress', description: 'Current implementation creates a new connection per Lambda cold start. Switching to RDS Proxy for connection reuse.' },
  { summary: 'Investigate slow query on reports endpoint', type: 'Bug', status: 'In Progress', description: 'P95 latency on GET /reports has climbed to 4.2s over the past week. Likely missing index on the updated_at column.' },

  // To do / open
  { summary: 'Add support for webhook retries with exponential backoff', type: 'Story', status: 'To Do', description: 'Failed webhook deliveries should retry up to 5 times with exponential backoff before marking as failed.' },
  { summary: 'Implement CSV export for audit logs', type: 'Story', status: 'To Do', description: 'Compliance team needs ability to export audit logs as CSV for a given date range.' },
  { summary: 'API key management UI', type: 'Story', status: 'To Do', description: 'Users need a self-serve page to create, rotate, and revoke API keys without contacting support.' },
  { summary: 'Set up structured logging with correlation IDs', type: 'Task', status: 'To Do', description: 'Add request correlation IDs to all log lines so we can trace a single request across multiple Lambda invocations.' },
  { summary: 'Fix broken OAuth flow on Safari 16', type: 'Bug', status: 'To Do', description: 'Safari blocks the third-party cookie used in the OAuth redirect, causing silent failures for ~8% of users.' },
  { summary: 'Document internal API contracts', type: 'Task', status: 'To Do', description: 'Write OpenAPI specs for all internal service-to-service APIs so consumers can generate typed clients.' },

  // Blocked
  { summary: 'Integrate with Stripe for usage-based billing', type: 'Story', status: 'To Do', description: 'Blocked: waiting on legal to review Stripe data processing agreement. Design doc is ready, implementation can start once unblocked.', labels: ['blocked'] },
  { summary: 'Enable CloudFront access logs for compliance audit', type: 'Task', status: 'To Do', description: 'Blocked: S3 bucket for log storage needs to be provisioned by infra team first.', labels: ['blocked'] },
]

// Fetch available issue types and statuses for this project
async function getProjectMeta() {
  const res = await fetch(`${base}/rest/api/3/project/${PROJECT}`, { headers })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to fetch project: ${res.status} ${text}`)
  }
  return res.json()
}

async function getIssueTypes() {
  const res = await fetch(`${base}/rest/api/3/issuetype/project?projectId=`, { headers })
  // Fall back to generic types
  return ['Story', 'Bug', 'Task']
}

async function createIssue(issue) {
  const body = {
    fields: {
      project: { key: PROJECT },
      summary: issue.summary,
      issuetype: { name: issue.type },
      description: issue.description ? {
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: issue.description }] }],
      } : undefined,
      labels: issue.labels ?? [],
    },
  }

  const res = await fetch(`${base}/rest/api/3/issue`, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!res.ok) {
    const text = await res.text()
    // If issue type not found, retry as Task
    if (text.includes('issuetype') && issue.type !== 'Task') {
      return createIssue({ ...issue, type: 'Task' })
    }
    throw new Error(`Failed to create "${issue.summary}": ${res.status} ${text}`)
  }
  return res.json()
}

async function getTransitions(issueKey) {
  const res = await fetch(`${base}/rest/api/3/issue/${issueKey}/transitions`, { headers })
  const data = await res.json()
  return data.transitions ?? []
}

async function transitionIssue(issueKey, targetStatus) {
  const transitions = await getTransitions(issueKey)
  // Find a transition whose name or target status matches
  const match = transitions.find(t =>
    t.name.toLowerCase().includes(targetStatus.toLowerCase()) ||
    t.to?.name?.toLowerCase().includes(targetStatus.toLowerCase())
  )
  if (!match) return // Can't find a matching transition, leave as-is

  await fetch(`${base}/rest/api/3/issue/${issueKey}/transitions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ transition: { id: match.id } }),
  })
}

async function main() {
  console.log(`Seeding ${issues.length} issues into project ${PROJECT} on ${DOMAIN}...\n`)

  // Verify project exists
  try {
    await getProjectMeta()
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }

  let created = 0
  let failed = 0

  for (const issue of issues) {
    try {
      const { key } = await createIssue(issue)
      process.stdout.write(`  ${key} created`)

      if (issue.status !== 'To Do') {
        await transitionIssue(key, issue.status)
        process.stdout.write(` → transitioned to "${issue.status}"`)
      }

      console.log()
      created++
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200))
    } catch (e) {
      console.error(`  FAILED: ${e.message}`)
      failed++
    }
  }

  console.log(`\nDone. ${created} created, ${failed} failed.`)
}

main()
