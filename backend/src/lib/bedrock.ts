import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import type { GithubEvent, AudienceMode } from '../types'
import type { RiskSignals } from './riskAnalysis'
import { postprocessContent } from './postprocessing'

const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-3-haiku-20240307-v1:0'
const client = new BedrockRuntimeClient({})

function periodLabel(days: number): string {
  if (days <= 7) return 'Weekly'
  if (days <= 14) return 'Bi-Weekly'
  if (days <= 31) return 'Monthly'
  return 'Quarterly'
}

function audienceLabel(audience: AudienceMode): string {
  if (audience === 'engineering') return 'Engineering Leadership'
  if (audience === 'product') return 'Product Leadership'
  return 'Executive / Non-Technical'
}

function buildSystemPrompt(label: string, audience: AudienceMode): string {
  const audienceName = audienceLabel(audience)

  const audienceGuidance: Record<AudienceMode, string> = {
    engineering: `This update is for Engineering Leadership. Allow moderate technical detail. Focus on execution progress, code movement, delivery risk, review bottlenecks, and quality concerns. Use engineering language naturally.`,
    product: `This update is for Product Leadership. Emphasize user-facing progress, scope movement, delivery confidence, cross-functional dependencies, and decisions made. Downplay low-level implementation detail unless it affects timeline or product quality. Frame everything in terms of feature movement and delivery.`,
    executive: `This update is for Executive / Non-Technical leadership. Use plain language throughout. Focus on outcomes, momentum, delivery confidence, and major risks. Avoid jargon. Prefer impact and direction over implementation specifics.`,
  }

  return `You are writing a concise ${label.toLowerCase()} project update for ${audienceName}.

Your job is to translate engineering activity into clear, leadership-ready status reporting.

${audienceGuidance[audience]}

Rules:
- Be specific and concrete
- Focus on outcomes, progress movement, risks, and scope changes
- Do not exaggerate or invent problems that are not supported by the data
- If risks are inferred rather than explicit, phrase them cautiously: "Potential risk", "May indicate", "Could slow"
- Avoid filler and generic phrases like "worked on" or "continued work"
- Keep the update useful and actionable for the selected audience

Required sections: Wins, In Progress, Risks / Blockers, Scope Changes`
}

function buildUserPrompt(
  events: GithubEvent[],
  label: string,
  context: string | undefined,
  signals: RiskSignals,
): string {
  const emphasized = events.filter(e => e.highlighted)
  const emphasisSection = emphasized.length > 0
    ? `EMPHASIZE these items — give them prominent placement:\n${emphasized.map(e => `- ${e.title}`).join('\n')}\n\n`
    : ''

  const contextSection = context?.trim()
    ? `Additional context from reporter:\n${context.trim()}\n\n`
    : ''

  const signalLines = [
    `Merged PRs: ${signals.mergedPrCount}`,
    `Open PRs: ${signals.openPrCount} (${signals.staleOpenPrCount} stale >3 days)`,
    `Opened issues: ${signals.openedIssueCount}`,
    `Closed issues: ${signals.closedIssueCount}`,
    `Commits: ${signals.commitCount}`,
    signals.hasReviewBottleneck ? '⚠ Review bottleneck detected' : null,
    signals.hasLowCompletionSignal ? '⚠ Low completion signal' : null,
    signals.hasPotentialScopeExpansion ? '⚠ Potential scope expansion' : null,
    signals.hasFragmentedExecution ? '⚠ Fragmented execution pattern' : null,
    signals.hasDeliveryCompressionRisk ? '⚠ Delivery compression risk (milestone context)' : null,
  ].filter(Boolean).join('\n')

  const inferredSection = signals.inferredRisks.length > 0
    ? `\nInferred risk signals:\n${signals.inferredRisks.map(r => `- ${r}`).join('\n')}`
    : ''

  return `${emphasisSection}${contextSection}Derived activity signals:
${signalLines}${inferredSection}

Curated activity (${label.toLowerCase()} window):
${JSON.stringify(events, null, 2)}

Write the update in markdown using exactly these headers:
## ${label} Update

### Wins
- ...

### In Progress
- ...

### Risks / Blockers
- ...

### Scope Changes
- ...

3–5 bullets per section max. If a section has nothing meaningful to report, write a single dash with a brief honest note.`
}

type BedrockResponse = { content: { type: string; text: string }[] }

export async function generateUpdate(
  events: GithubEvent[],
  days: number,
  audience: AudienceMode,
  context?: string,
  signals?: RiskSignals,
): Promise<string> {
  const label = periodLabel(days)
  const systemPrompt = buildSystemPrompt(label, audience)
  const userPrompt = buildUserPrompt(events, label, context, signals ?? {
    mergedPrCount: 0, openPrCount: 0, openedIssueCount: 0, closedIssueCount: 0, commitCount: 0,
    staleOpenPrCount: 0, staleOpenIssueCount: 0,
    hasHighWorkInProgress: false, hasReviewBottleneck: false, hasLowCompletionSignal: false,
    hasPotentialScopeExpansion: false, hasFragmentedExecution: false, hasDeliveryCompressionRisk: false,
    inferredRisks: [],
  })

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  const res = await client.send(command)
  const body = JSON.parse(new TextDecoder().decode(res.body)) as BedrockResponse
  const text = body.content.find(c => c.type === 'text')?.text ?? ''
  return postprocessContent(text)
}
