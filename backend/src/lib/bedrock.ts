import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import type { GithubEvent } from '../types'
import { postprocessContent } from './postprocessing'

const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-3-haiku-20240307-v1:0'
const client = new BedrockRuntimeClient({})

function periodLabel(days: number): string {
  if (days <= 7) return 'Weekly'
  if (days <= 14) return 'Bi-Weekly'
  if (days <= 31) return 'Monthly'
  return 'Quarterly'
}

function buildPrompt(events: GithubEvent[], label: string): string {
  const emphasized = events.filter(e => e.highlighted)
  const emphasisSection = emphasized.length > 0
    ? 'EMPHASIZE these items — give them prominent placement:\n' + emphasized.map(e => `- ${e.title}`).join('\n') + '\n\n'
    : ''

  return emphasisSection + `Summarize the following engineering activity into a ${label} update:

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
* Avoid generic phrases like "worked on" or "continued work"

Output format (use exactly these headers):
## ${label} Update

### Wins
- ...

### In Progress
- ...

### Risks / Blockers
- ...

### Scope Changes
- ...

Activity:
${JSON.stringify(events, null, 2)}`
}

type BedrockResponse = { content: { type: string; text: string }[] }

export async function generateUpdate(events: GithubEvent[], days: number): Promise<string> {
  const label = periodLabel(days)
  const systemPrompt = `You are a senior engineering manager writing a concise ${label.toLowerCase()} update for leadership. Focus on outcomes, risks, and changes. Avoid fluff.`
  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: buildPrompt(events, label) }],
    }),
  })

  const res = await client.send(command)
  const body = JSON.parse(new TextDecoder().decode(res.body)) as BedrockResponse
  const text = body.content.find(c => c.type === 'text')?.text ?? ''
  return postprocessContent(text)
}
