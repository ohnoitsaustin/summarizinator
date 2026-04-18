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
  hiddenAuthors: Set<string>
  highlightedAuthors: Set<string>
  onToggleHide: (id: string) => void
  onToggleHighlight: (id: string) => void
  onToggleHideAuthor: (author: string) => void
  onToggleHighlightAuthor: (author: string) => void
}

export default function EventList({
  events,
  hiddenIds,
  highlightedIds,
  hiddenAuthors,
  highlightedAuthors,
  onToggleHide,
  onToggleHighlight,
  onToggleHideAuthor,
  onToggleHighlightAuthor,
}: Props) {
  const authors = Array.from(new Set(events.map(e => e.author)))

  return (
    <div className="space-y-3">
      {/* Author filter bar */}
      <div className="flex flex-wrap gap-2">
        {authors.map(author => {
          const hidden = hiddenAuthors.has(author)
          const highlighted = highlightedAuthors.has(author)
          return (
            <div
              key={author}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition-colors ${
                hidden
                  ? 'border-brand-mid/20 opacity-40 bg-brand-surface/20'
                  : highlighted
                  ? 'border-brand-accent/60 bg-brand-surface/60'
                  : 'border-brand-mid/40 bg-brand-surface/30'
              }`}
            >
              <span className={hidden ? 'line-through text-brand-mid' : 'text-brand-accent/90'}>
                @{author}
              </span>
              <button
                onClick={() => onToggleHighlightAuthor(author)}
                disabled={hidden}
                title={highlighted ? 'Remove author emphasis' : 'Emphasize author'}
                className={`leading-none transition-colors disabled:opacity-30 ${
                  highlighted ? 'text-yellow-400' : 'text-brand-mid hover:text-yellow-400'
                }`}
              >
                ★
              </button>
              <button
                onClick={() => onToggleHideAuthor(author)}
                title={hidden ? 'Show author' : 'Hide author'}
                className={`leading-none transition-colors ${
                  hidden ? 'text-brand-mid hover:text-brand-accent' : 'text-brand-mid hover:text-red-400'
                }`}
              >
                {hidden ? '👁' : '🚫'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Event rows */}
      <div className="space-y-1">
        <p className="text-brand-mid text-xs">
          {events.length} events — hide/star individual events to override author defaults
        </p>
        {events.map(event => {
          const authorHidden = hiddenAuthors.has(event.author)
          const authorHighlighted = highlightedAuthors.has(event.author)
          const hidden = hiddenIds.has(event.id) || authorHidden
          const highlighted = highlightedIds.has(event.id) || authorHighlighted
          const superHighlighted = highlightedIds.has(event.id) && authorHighlighted

          return (
            <div
              key={event.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                hidden
                  ? 'border-brand-mid/20 opacity-40'
                  : superHighlighted
                  ? 'border-yellow-400/70 bg-brand-surface/70'
                  : highlighted
                  ? 'border-brand-accent/50 bg-brand-surface/50'
                  : 'border-brand-mid/30 bg-brand-surface/20'
              }`}
            >
              <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[event.type]}`}>
                {TYPE_LABELS[event.type]}
              </span>
              <a
                href={event.url}
                target="_blank"
                rel="noreferrer"
                className={`flex-1 text-sm truncate transition-colors hover:text-white ${
                  superHighlighted ? 'text-white font-semibold' : highlighted ? 'text-brand-accent' : 'text-brand-accent/80'
                }`}
              >
                {event.title}
              </a>
              <span className="shrink-0 text-xs text-brand-mid">@{event.author}</span>
              <button
                onClick={() => onToggleHighlight(event.id)}
                disabled={authorHidden || hiddenIds.has(event.id)}
                title={highlightedIds.has(event.id) ? 'Remove emphasis' : 'Emphasize'}
                className={`shrink-0 text-base leading-none transition-colors disabled:opacity-30 ${
                  highlightedIds.has(event.id) ? 'text-yellow-400' : 'text-brand-mid hover:text-yellow-400'
                }`}
              >
                ★
              </button>
              <button
                onClick={() => onToggleHide(event.id)}
                disabled={authorHidden}
                title={hiddenIds.has(event.id) ? 'Show' : 'Hide'}
                className={`shrink-0 text-base leading-none transition-colors disabled:opacity-30 ${
                  hiddenIds.has(event.id) ? 'text-brand-mid hover:text-brand-accent' : 'text-brand-mid hover:text-red-400'
                }`}
              >
                {hiddenIds.has(event.id) ? '👁' : '🚫'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
