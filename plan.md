# Upward Status Generator — Build Plan

## TL;DR

Build a SaaS that generates clean, executive-ready weekly updates from GitHub activity in ~30 seconds.

Core value:

* Save managers time
* Make them look organized and in control
* Reduce manual status writing

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Vite + React + TypeScript | SPA deploys cleanly to S3/CloudFront as a PWA; no SSR complexity |
| PWA | vite-plugin-pwa | Service worker + manifest generation |
| Styling | Tailwind CSS | No build-time CSS complexity |
| Backend | AWS Lambda (Node.js 20 + TypeScript) | Serverless, low-cost, scales to zero |
| API | API Gateway HTTP API | Cheaper and simpler than REST API; sufficient for this use case |
| Database | DynamoDB (single-table) | Low cost, serverless, no provisioning |
| Auth | GitHub OAuth (custom Lambda handler) | One OAuth flow covers both app login and repo access; no Cognito needed |
| LLM | Amazon Bedrock (Claude 3.5 Sonnet) | Stays in AWS; billed via AWS account |
| Static Hosting | S3 + CloudFront | Standard PWA hosting pattern |
| IaC | AWS CDK (TypeScript) | Native AWS, same language as backend |
| CI/CD | GitHub Actions | Deploy on push to `main` |
| Secrets | AWS SSM Parameter Store | GitHub OAuth credentials, Bedrock config |
| Bundler | esbuild (via CDK) | Fast Lambda bundle compilation |

---

## Infrastructure

```
GitHub Actions
    ↓ cdk deploy + s3 sync
CloudFront → S3 (Vite PWA)
    ↓ /api/*
API Gateway HTTP API
    ↓
Lambda functions (TypeScript)
    ├── auth (GitHub OAuth callback)
    ├── projects (CRUD)
    └── updates (generate + fetch)
    ↓
DynamoDB (single table)
    + Bedrock (Claude 3.5 Sonnet)
    + GitHub API (from Lambda)
    + SSM Parameter Store (secrets)
```

### AWS Services Summary
- **Lambda**: all backend logic
- **API Gateway HTTP API**: single regional endpoint, JWT authorizer
- **DynamoDB**: one table, on-demand billing
- **S3**: static PWA assets
- **CloudFront**: CDN, HTTPS, SPA fallback routing
- **SSM Parameter Store**: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `JWT_SECRET`
- **Bedrock**: LLM inference (Claude 3.5 Sonnet via `us-east-1`)

---

## CI/CD Pipeline

### GitHub Actions Workflow (`.github/workflows/deploy.yml`)

Triggers: push to `main`

Steps:
1. Install dependencies (`npm ci`)
2. Run type check + tests
3. Build Vite frontend (`npm run build`)
4. CDK deploy (Lambda + API Gateway + DynamoDB + SSM)
5. Sync `dist/` to S3 bucket
6. CloudFront invalidation (`/*`)

Required GitHub Actions secrets:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

IAM role used by Actions should be scoped to: CDK bootstrap bucket, Lambda deploy, DynamoDB table management, S3 sync, CloudFront invalidation.

---

## V1 Scope (STRICT)

### Must Have

* GitHub integration (repos)
* Fetch PRs + issues (last 7 days)
* Generate structured update via LLM
* Editable output
* Copy to clipboard

### Explicitly Excluded (V1)

* Slack integration
* Jira integration
* Auto-sending updates
* Multi-user teams
* Analytics/dashboard

---

## Core User Flow

1. User signs in
2. Connects GitHub account
3. Selects repository
4. Clicks “Generate Update”
5. Reviews/edits output
6. Copies and sends manually

---

## Data Model

### DynamoDB — Single Table

Table name: `summarizinator`
Billing: on-demand

#### Key Schema

| Entity | PK | SK |
|---|---|---|
| User | `USER#<id>` | `#METADATA` |
| Project | `USER#<userId>` | `PROJECT#<projectId>` |
| Update | `PROJECT#<projectId>` | `UPDATE#<createdAt ISO>` |

#### GSI

**GSI1** — email lookup
- GSI1PK: `EMAIL#<email>`
- GSI1SK: `USER#<id>`

#### Access Patterns

| Operation | Method |
|---|---|
| Get user by id | Query PK=`USER#id`, SK=`#METADATA` |
| Get user by email | GSI1 query on `EMAIL#email` |
| List projects for user | Query PK=`USER#userId`, SK begins_with `PROJECT#` |
| Get single project | Query PK=`USER#userId`, SK=`PROJECT#projectId` |
| List updates for project | Query PK=`PROJECT#projectId`, SK begins_with `UPDATE#` |
| Get single update | Query PK=`PROJECT#projectId`, SK=`UPDATE#<createdAt>` |

#### Entity Attributes

**User**
- `id` (uuid)
- `email`
- `githubAccessToken` (encrypted at rest via DynamoDB encryption)
- `githubTokenExpiry` (ISO timestamp, null if token doesn't expire)
- `githubLogin` (GitHub username, for display)
- `createdAt`

**Project**
- `id` (uuid)
- `userId`
- `name`
- `repoOwner`
- `repoName`
- `createdAt`

**Update**
- `id` (uuid)
- `projectId`
- `content` (final markdown)
- `rawEvents` (JSON — cached GitHub events, enables regenerate without re-fetching)
- `createdAt`

---

## GitHub Integration

### Auth

**Decision: GitHub OAuth (not GitHub App)**

GitHub OAuth is simpler to ship for V1 and covers the use case (read access to user's repos). GitHub App is better for org-wide installs — defer to V2 if multi-user teams are added.

One OAuth flow handles both:
1. App authentication (identify the user)
2. Repo access (read PRs, issues, commits)

Flow:
1. Frontend redirects to GitHub OAuth with `repo:read` scope
2. GitHub redirects to `/api/auth/callback?code=...`
3. Lambda exchanges code for access token via GitHub API
4. Lambda creates/updates user in DynamoDB, stores token
5. Lambda issues a signed JWT (via `JWT_SECRET` in SSM), returns it to frontend
6. Frontend stores JWT in `localStorage`, includes as `Authorization: Bearer` on all API calls
7. API Gateway HTTP API JWT authorizer validates the token

Required OAuth scopes: `read:user`, `repo` (for private repos) or `public_repo` (public only)

### Data to Fetch

For a given repo + time window (default: 7 days):

* Pull Requests:

  * merged PRs
  * open PRs

* Issues:

  * closed issues
  * opened issues

* Commits:

  * commit messages on configured branches

---

## Event Normalization

```ts
type Event = {
  type: 'pr_merged' | 'pr_opened' | 'issue_closed' | 'issue_opened' | 'commit'
  title: string   // commit message for 'commit' type
  body?: string   // PR/issue body; omitted for commits
  author: string
  createdAt: string
  url?: string    // GitHub permalink, passed to LLM for context
}
```

---

## Event Preprocessing

Before sending to the LLM:

### Filter Noise

Drop events where:

* title length < 5 words
* contains:

  * "typo"
  * "lint"
  * "format"
  * "minor"
  * "fix whitespace"

### Deduplicate

* Remove near-identical titles
* Prefer merged PR over issue if both reference same work

### Optional Grouping (simple)

* Group by keyword overlap (basic)
* Not required for V1, but helpful

---

## LLM Generation

### Prompt (baseline)

System:
"You are a senior engineering manager writing a concise weekly update for leadership. Focus on outcomes, risks, and changes. Avoid fluff."

User:
"Summarize the following engineering activity into:

* Wins
* In Progress
* Risks / Blockers
* Scope Changes

Rules:

* 3–5 bullet points per section max
* Be specific and concrete
* Highlight impact, not just activity
* Call out risks even if subtle
* Identify scope changes when new work appears
* Avoid generic phrases like 'worked on' or 'continued work'

Activity: <JSON events>"

---

## Output Format (strict)

```
## Weekly Update

### Wins
- ...

### In Progress
- ...

### Risks / Blockers
- ...

### Scope Changes
- ...
```

---

## Post-processing

* Ensure all sections exist
* Limit bullets to 3–5 per section
* Trim overly verbose lines
* Remove repetition

---

## API Design

### POST /api/updates/generate

Input:

```json
{
  "projectId": "uuid",
  "days": 7
}
```

Flow:

1. Fetch project from DynamoDB
2. Pull GitHub data (PRs, issues, commits via GitHub REST API)
3. Normalize events to `Event[]`
4. Filter + preprocess
5. Send to Bedrock (Claude 3.5 Sonnet)
6. Post-process output
7. Store update (content + rawEvents) in DynamoDB
8. Return content

Output:

```json
{
  "updateId": "uuid",
  "content": "## Weekly Update..."
}
```

### POST /api/updates/:id/regenerate

Uses cached `rawEvents` from the existing update — skips GitHub fetch entirely.
Re-runs steps 4–8 only. Same cost as generate but faster (no GitHub API calls).

### GET /api/projects/:id/updates

Returns list of past updates for a project (id, createdAt, content preview).

---

## UI Structure

### Dashboard

* List projects
* “Generate Update” button

### Project Page

* Button: Generate Update
* List of past updates

### Editor

* Textarea or block editor
* Buttons:

  * Copy to clipboard
  * Regenerate
  * Save

---

## Component Breakdown

* ProjectList
* ProjectCard
* GenerateButton
* UpdateEditor
* CopyButton

---

## Milestones

### Phase 1 — Foundation (Day 1–2)

[x] Auth
[x] Project creation

### Phase 2 — GitHub Integration (Day 3–4)

[x] Connect account
[x] Fetch PRs + issues
[x] Normalize events

### Phase 3 — LLM Generation (Day 5)

[x] Prompt integration
[x] First usable output

### Phase 4 — UI + Editing (Day 6)

[x] Editor page
[x] Copy flow

### Phase 5 — Polish + Deploy (Day 7)

[ ] Error handling
[ ] Loading states

---

## Success Criteria (V1)

User can:

* Connect repo
* Generate update in <30 seconds
* Copy and send with minimal edits

Primary metric:

* Time saved vs manual writing

---

## Known Risks

### Weak Input Data

Mitigation:

* filtering
* prompt tuning

### Generic AI Output

Mitigation:

* iterate prompt
* enforce structure

### Trust Barrier

Mitigation:

* always allow editing
* never auto-send in V1

### GitHub API Rate Limits

OAuth tokens are limited to 5,000 requests/hour. A busy repo (many PRs, issues, commits over 7 days) can require many paginated requests.

Mitigation:

* Fetch only what's needed (limit pagination depth)
* Cache rawEvents in DynamoDB — regenerate never re-hits GitHub
* Log rate limit headers (`X-RateLimit-Remaining`) from Lambda for observability

### Bedrock Model Access

Bedrock requires explicit model access requests per region. Claude 3.5 Sonnet must be enabled in the AWS account before first deploy.

Mitigation:

* Document as a prerequisite in the README
* Request access during Phase 3 setup, not at deploy time

### JWT Token Expiry / GitHub Token Refresh

GitHub OAuth tokens do not expire by default (unless the app uses token expiration feature). If expiration is enabled, tokens need refreshing.

Mitigation:

* For V1: disable GitHub token expiration in OAuth app settings
* Store `githubTokenExpiry` now so V2 refresh logic has a field to work with

---

## V1.5 (Next Steps)

* Slack integration (pull activity + send updates)
* Auto weekly generation
* Tone controls (executive vs detailed)
* Multi-repo aggregation

---

## Guiding Principle

This is NOT a dashboard.

This is a **translation engine**:
raw activity → executive clarity

If it doesn’t make the user look sharp with minimal effort, it’s wrong.
