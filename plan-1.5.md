# Summarizinator — plan-1.5.md

## Multi-Platform Support (Jira First, Clean Architecture)

---

## TL;DR

Add Jira as a second supported source **without breaking the simplicity of the core system**.

Key principle:

> All platforms map to a single unified Event model.
> Everything downstream operates on Event[] only.

Do NOT build a “multi-platform system.”
Build a **single pipeline with multiple inputs**.

---

## Goals

* Support Jira as an alternative to GitHub
* Keep output quality consistent across sources
* Avoid branching logic throughout the codebase
* Preserve current UX and generation flow
* Set foundation for future platforms (Asana, etc.)

---

## Non-Goals

* Multi-source aggregation (one project = one source)
* Deep Jira feature support (sprints, story points, etc.)
* Perfect semantic mapping
* UI customization per platform
* Rewriting existing GitHub pipeline

---

## Core Architecture Change

### Introduce a Unified Event Model

All data from all platforms must normalize into this:

```ts
type Event = {
  id: string

  source: 'github' | 'jira' | 'asana'

  type: 'completed' | 'created' | 'in_progress' | 'updated' | 'blocked'

  title: string
  description?: string

  actor?: string
  assignee?: string

  createdAt: string
  updatedAt?: string

  status?: string
  labels?: string[]

  url?: string
}
```

### Critical Rule

After mapping:

> The rest of the system must not care where the event came from.

No downstream logic should branch on `source`.

---

## Data Model Changes

### Project Entity

Add:

* `source: 'github' | 'jira'`
* `sourceConfig: { ... }`

Example:

```ts
type Project = {
  id: string
  userId: string

  name: string

  source: 'github' | 'jira'

  sourceConfig: {
    // GitHub
    repoOwner?: string
    repoName?: string

    // Jira
    jiraProjectKey?: string
    jiraCloudId?: string
  }
}
```

---

## Integration Layer Design

### Create Source Adapters

Define a clean interface:

```ts
interface SourceAdapter {
  fetchEvents(params: {
    project: Project
    days: number
  }): Promise<Event[]>
}
```

### Implementations

* `githubAdapter`
* `jiraAdapter`

### Dispatcher

```ts
function getAdapter(source: Project['source']): SourceAdapter
```

---

## Step 0: Decouple Identity from GitHub OAuth ✅ DONE

### What was built

**Identity**: Cognito User Pool (`us-east-1_3Y1TtYaIA`) with email/password and Google federated login. Hosted UI domain: `summarizinator-dev.auth.us-east-1.amazoncognito.com`.

**Auth layer**: API Gateway JWT authorizer validates Cognito tokens on every protected route. Lambda handlers no longer do any JWT verification — they just read `requestContext.authorizer.jwt.claims.sub`.

**Data source credentials**: New `SourceConnection` DynamoDB entity keyed at `USER#<userId>` / `CONNECTION#<source>`. GitHub OAuth token lives here, not on the user record.

**New Lambda**: `ConnectionsFn` handles `GET/POST/DELETE /api/connections/github` — the GitHub data source OAuth flow (separate from login).

**Frontend**: Amplify v6 manages Cognito sessions (SRP auth, token refresh, Google redirect). Login page supports email/password with verification flow + Google. `AuthCallback` handles the Cognito redirect. `ConnectGitHub` at `/connect/github/callback` handles the data source link.

**Local dev**: `server.ts` decodes the Cognito JWT (no signature check) and injects claims into `requestContext`, so handlers behave identically locally and in production.

### What was deleted

* `backend/src/lib/jwt.ts` — custom JWT signing/verification
* `backend/src/handlers/auth.ts` — GitHub-as-identity handler
* All `verifyToken()` calls across every handler
* `User` DynamoDB entity — identity is now Cognito, no user records needed

### Key DynamoDB key pattern

```
PK: USER#<cognitoSub>   SK: CONNECTION#github
PK: USER#<cognitoSub>   SK: PROJECT#<projectId>
PK: PROJECT#<projectId> SK: UPDATE#<createdAt>
```

### Note on GitHub as identity provider

GitHub doesn't support OIDC natively so it cannot be a Cognito federated provider without a proxy. Skipped for now. Users log in with email/password or Google; GitHub is connected separately as a data source.

### SSM parameters (dev)

```
/summarizinator/dev/github-client-id      — GitHub OAuth app (data source)
/summarizinator/dev/github-client-secret  — GitHub OAuth app secret
/summarizinator/dev/google-client-id      — Google OAuth app
/summarizinator/dev/google-client-secret  — Google OAuth app secret (plain String)
```

Note: `google-client-secret` is stored as SSM String (not SecureString) because CloudFormation does not support SSM SecureString dynamic references in `AWS::Cognito::UserPoolIdentityProvider`.

---

## Step 1: Refactor GitHub → Event Mapping

### Goal

Move current GitHub logic into a proper adapter.

### Tasks

* Extract existing fetch logic
* Add mapping layer → Event[]
* Ensure all downstream code uses Event[]

### Mapping Rules

| GitHub Object | Event.type  |
| ------------- | ----------- |
| merged PR     | completed   |
| open PR       | in_progress |
| closed issue  | completed   |
| opened issue  | created     |

---

## Step 2: Jira Integration

### Auth

Use Jira Cloud OAuth (3LO)

Minimum scopes:

* read issues
* read project metadata

---

## Step 3: Fetch Jira Data

### Endpoint

Use Jira Search API:

`GET /rest/api/3/search`

### Query

Basic JQL:

```
project = <KEY> AND updated >= -<N>d
```

Where N = selected time window

---

## Step 4: Jira → Event Mapping

### Core Mapping

| Jira Field               | Event       |
| ------------------------ | ----------- |
| issue.fields.summary     | title       |
| issue.fields.description | description |
| issue.fields.assignee    | assignee    |
| issue.fields.creator     | actor       |
| issue.fields.created     | createdAt   |
| issue.fields.updated     | updatedAt   |
| issue.fields.status.name | status      |

---

### Status → Event.type

Use simple mapping:

```ts
function mapStatusToType(status: string): Event['type'] {
  const s = status.toLowerCase()

  if (s.includes('done') || s.includes('closed')) return 'completed'
  if (s.includes('progress') || s.includes('in progress')) return 'in_progress'
  if (s.includes('block')) return 'blocked'

  return 'created'
}
```

---

### Labels

Map:

* issue.fields.labels → labels

---

### URL

Construct:

```
https://<your-domain>.atlassian.net/browse/<ISSUE-KEY>
```

---

## Step 5: Pipeline Integration

Ensure this pipeline:

```
fetchEvents (adapter)
    ↓
Event[]
    ↓
curation
    ↓
derived signals
    ↓
LLM
```

### Hard Rule

No platform-specific logic after `fetchEvents`.

---

## Step 6: UI Changes

### Project Creation

Add:

* Source selector:

  * GitHub (default)
  * Jira

### Conditional Inputs

If GitHub:

* repo picker

If Jira:

* project key input
* (optional later: project selector)

---

### Event Display

Reuse existing UI:

* title
* actor
* timestamp
* type indicator

Do NOT show:

* Jira-specific jargon

---

## Step 7: API Changes

### Fetch Events

`GET /api/projects/:id/events`

Now:

* resolve adapter
* return normalized Event[]

---

### Generate Update

No major changes

Ensure:

* rawEvents now store Event[] instead of GitHub-specific shape

---

## Step 8: Risk Detection Compatibility

Ensure derived signal logic works with:

* Event.type
* createdAt / updatedAt
* counts

Avoid relying on:

* PR-specific fields
* commit-specific logic

---

## Step 9: Testing Plan

### Scenario 1: GitHub baseline

Ensure:

* no regression in output quality

---

### Scenario 2: Jira only

Test:

* completed-heavy week
* in-progress-heavy week
* mixed activity

---

### Scenario 3: Edge cases

* All tasks still open
* Many tasks updated but none closed
* Blocked tasks present

---

### Output Requirement

Jira-based output should feel:

> indistinguishable in quality from GitHub output

---

## Step 10: Guardrails

### DO

* keep mapping simple
* bias toward consistency over completeness
* keep UI unchanged where possible

---

### DO NOT

* add per-platform UI
* expose Jira fields directly
* support multiple sources per project
* special-case prompt logic per source

---

## Phase 1.5 Milestones

### Day 0 ✅

* Cognito User Pool provisioned (email/password + Google federated)
* Cognito JWT authorizer wired into API Gateway (all protected routes)
* SourceConnection model in DynamoDB (`USER#<id> / CONNECTION#<source>`)
* GitHub token moved from user record → SourceConnection
* ConnectionsFn Lambda + `/api/connections/github` routes deployed
* Frontend migrated to Amplify v6; Login page supports email/password + Google
* Old AuthFn Lambda and custom JWT library deleted

### Day 1

* Event model defined
* GitHub adapter refactored (reads token from SourceConnection)

### Day 2

* Jira auth + fetch working (stores token in SourceConnection)

### Day 3

* Jira → Event mapping complete
* Pipeline unified

### Day 4

* UI adjustments (login flow, source connection UI)
* Testing + polish

---

## Success Criteria

* User can create a Jira-backed project
* Generate update works identically to GitHub flow
* Output quality is comparable
* No visible platform leakage in UI or output

---

## Future Expansion (Do Not Build Yet)

* Asana adapter
* Multi-source projects
* Cross-project summaries
* Slack ingestion

---

## Final Principle

You are not building integrations.

You are building:

> a system that understands work, regardless of where it lives.

If the user can’t tell whether the data came from GitHub or Jira—

you did it right.
