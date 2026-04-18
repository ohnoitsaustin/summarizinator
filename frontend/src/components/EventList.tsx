import type { GithubEvent } from '../api/client'

const TYPE_LABELS: Record<GithubEvent['type'], string> = {
  pr_merged: 'PR Merged',
  pr_opened: 'PR Opened',
  issue_closed: 'Issue Closed',
  issue_opened: 'Issue Opened',
  commit: 'Commit',
}

const TYPE_COLORS: Record<GithubEvent['type'], string> = {
  pr_merged: 'bg-emerald-900/60 text-emerald-300',
  pr_opened: 'bg-blue-900/60 text-blue-300',
  issue_closed: 'bg-brand-mid/60 text-brand-accent',
  issue_opened: 'bg-yellow-900/60 text-yellow-300',
  commit: 'bg-brand-surface text-brand-accent/70',
}

type Props = {
  events: GithubEvent[]
  hiddenIds: Set<string>
  highlightedIds: Set<string>
  onToggleHide: (id: string) => void
  onToggleHighlight: (id: string) => void
}

export default function EventList({ events, hiddenIds, highlightedIds, onToggleHide, onToggleHighlight }: Props) {
  return (
    <div className="space-y-1">
      <p className="text-brand-mid text-sm mb-2">
        {events.length} events — hide to exclude from report, star to emphasize
      </p>
      {events.map(event => {
        const hidden = hiddenIds.has(event.id)
        const highlighted = highlightedIds.has(event.id)
        return (
          <div
            key={event.id}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
              hidden
                ? 'border-brand-mid/20 opacity-40'
                : highlighted
                ? 'border-brand-accent/60 bg-brand-surface/60'
                : 'border-brand-mid/30 bg-brand-surface/30'
            }`}
          >
            <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[event.type]}`}>
              {TYPE_LABELS[event.type]}
            </span>
            <a
              href={event.url}
              target="_blank"
              rel="noreferrer"
              className="flex-1 text-sm text-brand-accent/90 hover:text-white truncate transition-colors"
            >
              {event.title}
            </a>
            <span className="shrink-0 text-xs text-brand-mid">{event.author}</span>
            <button
              onClick={() => onToggleHighlight(event.id)}
              disabled={hidden}
              title={highlighted ? 'Remove emphasis' : 'Emphasize'}
              className={`shrink-0 text-base leading-none transition-colors disabled:opacity-30 ${
                highlighted ? 'text-yellow-400' : 'text-brand-mid hover:text-yellow-400'
              }`}
            >
              ★
            </button>
            <button
              onClick={() => onToggleHide(event.id)}
              title={hidden ? 'Show' : 'Hide'}
              className={`shrink-0 text-base leading-none transition-colors ${
                hidden ? 'text-brand-mid hover:text-brand-accent' : 'text-brand-mid hover:text-red-400'
              }`}
            >
              {hidden ? '👁' : '🚫'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
