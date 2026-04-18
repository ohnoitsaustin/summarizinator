# Summarizinator

Turn GitHub activity into executive-ready weekly updates in under 30 seconds.

Summarizinator pulls PRs, issues, and commits from a GitHub repository, lets you curate what matters, and generates a clean structured update using Claude via Amazon Bedrock — ready to copy and send.

---

## Features

- **GitHub OAuth login** — one flow covers both authentication and repository access
- **Multi-project dashboard** — track multiple repositories, each with their own update history
- **Configurable time spans** — generate Weekly, Bi-Weekly, Monthly, or Quarterly updates
- **Event curation** — star or hide individual commits, PRs, and issues before generating; filter by author
- **Drag-to-select** — drag across event rows to bulk-star or bulk-hide
- **LLM-powered generation** — sends curated events to Claude and returns a structured update with Wins, In Progress, Risks/Blockers, and Scope Changes sections
- **Regenerate** — tweak curation and regenerate without re-fetching GitHub (uses cached events)
- **Markdown preview** — toggle between edit and rendered preview in the update editor
- **Copy to clipboard** — one click to copy the final update
- **Update history** — past updates are saved per project; expand, edit, or delete any of them with undo support
- **PWA** — installable as a progressive web app

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React + TypeScript |
| Styling | Tailwind CSS |
| PWA | vite-plugin-pwa |
| Backend | AWS Lambda (Node.js 20 + TypeScript) |
| API | AWS API Gateway HTTP API |
| Database | DynamoDB (single-table design) |
| Auth | GitHub OAuth (custom Lambda handler + JWT) |
| LLM | Amazon Bedrock — Claude 3 Haiku |
| Static Hosting | S3 + CloudFront |
| Infrastructure | AWS CDK (TypeScript) |
| CI/CD | GitHub Actions |
| Secrets | AWS SSM Parameter Store |

---

## Infrastructure

```
GitHub Actions
    ↓ cdk deploy + s3 sync
CloudFront → S3 (Vite PWA)
    ↓ /api/*
API Gateway HTTP API
    ↓
Lambda (TypeScript)
    ├── auth handler    (GitHub OAuth exchange, JWT issuance)
    ├── projects handler (CRUD)
    └── updates handler  (generate, regenerate, fetch events, list, edit, delete)
    ↓
DynamoDB (single table, on-demand)
    + Bedrock (Claude 3 Haiku, us-east-1 cross-region inference)
    + GitHub REST API
    + SSM Parameter Store
```

### Environments

| Environment | Domain | Branch |
|---|---|---|
| Production | summarizinator.com | `main` |
| Development | dev.summarizinator.com | `develop` |

Each environment has its own DynamoDB table, SSM parameter paths, and CloudFront distribution.

---

## Data Model

DynamoDB single-table with the following key schema:

| Entity | PK | SK |
|---|---|---|
| User | `USER#<id>` | `#METADATA` |
| Project | `USER#<userId>` | `PROJECT#<projectId>` |
| Update | `PROJECT#<projectId>` | `UPDATE#<createdAt>` |

Updates store `rawEvents` (cached GitHub activity JSON) so regeneration never re-hits the GitHub API.

---

## API

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/token` | Exchange GitHub OAuth code for JWT |
| GET | `/api/projects` | List user's projects |
| POST | `/api/projects` | Create a project |
| DELETE | `/api/projects/:id` | Delete a project |
| GET | `/api/projects/:id/updates` | List updates for a project |
| GET | `/api/projects/:id/events` | Fetch latest GitHub events |
| POST | `/api/updates/generate` | Generate a new update |
| POST | `/api/updates/:id/regenerate` | Regenerate using cached events |
| PATCH | `/api/updates/:id` | Edit update content |
| DELETE | `/api/updates/:id` | Delete an update |

---

## Local Development

### Prerequisites

- Node.js 20+
- AWS account with Bedrock model access enabled for Claude 3 Haiku in `us-east-1`
- GitHub OAuth App (client ID + secret)

### Setup

```bash
# Install root dependencies
npm install

# Frontend
cd frontend && npm install
cp .env.example .env.local   # set VITE_GITHUB_CLIENT_ID and VITE_API_BASE_URL
npm run dev

# Backend — deploy to AWS (no local Lambda emulation)
cd infra && npm install
cdk deploy Summarizinator-dev
```

### Required SSM Parameters (per environment)

```
/summarizinator/dev/github-client-id
/summarizinator/dev/github-client-secret
/summarizinator/dev/jwt-secret
```

### Required GitHub Actions Secrets

```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
GH_CLIENT_ID_DEV
GH_CLIENT_ID_PROD
CERT_ARN_DEV
CERT_ARN_PROD
```

---

## Deployment

Push to `develop` → deploys to dev.summarizinator.com  
Push to `main` → deploys to summarizinator.com

The GitHub Actions workflow: installs deps, type-checks, builds the Vite frontend, runs `cdk deploy`, syncs `dist/` to S3, and invalidates the CloudFront cache.
