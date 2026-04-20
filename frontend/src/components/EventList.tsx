import React, { useRef, useEffect, useLayoutEffect, useState } from 'react'
import type { Event } from '../api/client'

const TYPE_PRIORITY: Record<Event['type'], number> = {
  completed:   0,
  in_progress: 1,
  blocked:     2,
  created:     3,
  updated:     4,
}

function eventActor(e: Event): string {
  return e.actor ?? e.assignee ?? '?'
}

function sortEvents(
  evts: Event[],
  hiddenIds: Set<string>,
  highlightedIds: Set<string>,
  hiddenAuthors: Set<string>,
  highlightedAuthors: Set<string>,
): Event[] {
  return [...evts].sort((a, b) => {
    const aActor = eventActor(a)
    const bActor = eventActor(b)
    const aHidden = hiddenIds.has(a.id) || hiddenAuthors.has(aActor)
    const bHidden = hiddenIds.has(b.id) || hiddenAuthors.has(bActor)
    const aHL = highlightedIds.has(a.id) || highlightedAuthors.has(aActor)
    const bHL = highlightedIds.has(b.id) || highlightedAuthors.has(bActor)
    if (aHL !== bHL) return Number(bHL) - Number(aHL)
    if (aHidden !== bHidden) return Number(aHidden) - Number(bHidden)
    const typeDiff = TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type]
    if (typeDiff !== 0) return typeDiff
    return b.createdAt.localeCompare(a.createdAt)
  })
}

const TYPE_ORDER: Event['type'][] = ['completed', 'in_progress', 'blocked', 'created', 'updated']
const DEFAULT_PER_TYPE = 3

const TYPE_LABELS: Record<Event['type'], string> = {
  completed:   'Completed',
  in_progress: 'In Progress',
  blocked:     'Blocked',
  created:     'Created',
  updated:     'Updated',
}

const TYPE_COLORS: Record<Event['type'], string> = {
  completed:   'bg-emerald-900/60 text-emerald-300',
  in_progress: 'bg-blue-900/60 text-blue-300',
  blocked:     'bg-red-900/60 text-red-300',
  created:     'bg-yellow-900/60 text-yellow-300',
  updated:     'bg-brand-surface text-brand-accent/70',
}

type DragState = {
  action: 'hide' | 'highlight'
  targetState: boolean
  processed: Set<string>
  virtualState: Set<string>
}

function AuthorChip({ author, count, hiddenAuthors, highlightedAuthors, onToggleHide, onToggleHighlight }: {
  author: string
  count: number
  hiddenAuthors: Set<string>
  highlightedAuthors: Set<string>
  onToggleHide: (a: string) => void
  onToggleHighlight: (a: string) => void
}) {
  const hidden = hiddenAuthors.has(author)
  const highlighted = highlightedAuthors.has(author)
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition-colors ${
      hidden ? 'border-brand-light/20 opacity-40 bg-brand-surface/20'
      : highlighted ? 'border-brand-accent/60 bg-brand-surface/60'
      : 'border-brand-light/40 bg-brand-surface/30'
    }`}>
      <span className={hidden ? 'line-through text-brand-light' : 'text-brand-accent/90'}>
        @{author}
      </span>
      <span className="text-brand-light/50">{count}</span>
      <button onClick={() => onToggleHighlight(author)} disabled={hidden} title={highlighted ? 'Remove emphasis' : 'Emphasize'}
        className={`leading-none transition-colors disabled:opacity-30 ${highlighted ? 'text-yellow-400' : 'text-brand-light hover:text-yellow-400'}`}>
        ★
      </button>
      <button onClick={() => onToggleHide(author)} title={hidden ? 'Show' : 'Hide'}
        className={`leading-none transition-colors ${hidden ? 'text-brand-light hover:text-brand-accent' : 'text-brand-light hover:text-red-400'}`}>
        {hidden ? '👁' : '🚫'}
      </button>
    </div>
  )
}

function EventRow({ event, hiddenIds, highlightedIds, hiddenAuthors, highlightedAuthors, itemRefs, startDrag, enterDrag }: {
  event: Event
  hiddenIds: Set<string>
  highlightedIds: Set<string>
  hiddenAuthors: Set<string>
  highlightedAuthors: Set<string>
  itemRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
  startDrag: (id: string, action: 'hide' | 'highlight', e: React.MouseEvent) => void
  enterDrag: (id: string, action: 'hide' | 'highlight') => void
}) {
  const actor = eventActor(event)
  const authorHidden = hiddenAuthors.has(actor)
  const authorHighlighted = highlightedAuthors.has(actor)
  const hidden = hiddenIds.has(event.id) || authorHidden
  const highlighted = highlightedIds.has(event.id) || authorHighlighted
  const superHighlighted = highlightedIds.has(event.id) && authorHighlighted
  return (
    <div
      ref={el => { if (el) itemRefs.current.set(event.id, el); else itemRefs.current.delete(event.id) }}
      className={`px-3 py-2 rounded-lg border transition-colors ${
        hidden ? 'border-brand-light/20 opacity-40'
        : superHighlighted ? 'border-yellow-400/70 bg-brand-surface/70'
        : highlighted ? 'border-brand-accent/50 bg-brand-surface/50'
        : 'border-brand-light/30 bg-brand-surface/20'
      }`}
    >
      <div className="flex items-center gap-2">
        {event.url ? (
          <a href={event.url} target="_blank" rel="noreferrer"
            className={`flex-1 text-sm truncate transition-colors hover:text-white ${
              superHighlighted ? 'text-white font-semibold' : highlighted ? 'text-brand-accent' : 'text-brand-accent/80'
            }`}
          >
            {event.title}
          </a>
        ) : (
          <span className={`flex-1 text-sm truncate ${
            superHighlighted ? 'text-white font-semibold' : highlighted ? 'text-brand-accent' : 'text-brand-accent/80'
          }`}>
            {event.title}
          </span>
        )}
        <button
          onMouseDown={e => { if (!authorHidden && !hiddenIds.has(event.id)) startDrag(event.id, 'highlight', e) }}
          onMouseEnter={() => enterDrag(event.id, 'highlight')}
          disabled={authorHidden || hiddenIds.has(event.id)}
          title={highlightedIds.has(event.id) ? 'Remove emphasis' : 'Emphasize'}
          className={`shrink-0 text-base leading-none transition-colors disabled:opacity-30 cursor-pointer ${highlightedIds.has(event.id) ? 'text-yellow-400' : 'text-brand-light hover:text-yellow-400'}`}
        >★</button>
        <button
          onMouseDown={e => { if (!authorHidden) startDrag(event.id, 'hide', e) }}
          onMouseEnter={() => enterDrag(event.id, 'hide')}
          disabled={authorHidden}
          title={hiddenIds.has(event.id) ? 'Show' : 'Hide'}
          className={`shrink-0 text-base leading-none transition-colors disabled:opacity-30 cursor-pointer ${hiddenIds.has(event.id) ? 'text-brand-light hover:text-brand-accent' : 'text-brand-light hover:text-red-400'}`}
        >{hiddenIds.has(event.id) ? '👁' : '🚫'}</button>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[event.type]}`}>{TYPE_LABELS[event.type]}</span>
        {actor !== '?' && <span className="text-xs text-brand-light">@{actor}</span>}
        {event.assignee && event.actor && event.assignee !== event.actor && (
          <span className="text-xs text-brand-light/50">→ {event.assignee}</span>
        )}
        <span className="text-xs text-brand-light/60" title={new Date(event.createdAt).toLocaleString()}>
          {new Date(event.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          {' '}
          {new Date(event.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}

type Props = {
  events: Event[]
  days: number
  hiddenIds: Set<string>
  highlightedIds: Set<string>
  hiddenAuthors: Set<string>
  highlightedAuthors: Set<string>
  onToggleHide: (id: string) => void
  onToggleHighlight: (id: string) => void
  onToggleHideAuthor: (author: string) => void
  onToggleHighlightAuthor: (author: string) => void
  onBulkHighlight: (ids: string[], value: boolean) => void
  onBulkHide: (ids: string[], value: boolean) => void
}

export default function EventList({
  events,
  days,
  hiddenIds,
  highlightedIds,
  hiddenAuthors,
  highlightedAuthors,
  onToggleHide,
  onToggleHighlight,
  onToggleHideAuthor,
  onToggleHighlightAuthor,
  onBulkHighlight,
  onBulkHide,
}: Props) {
  const dragRef = useRef<DragState | null>(null)
  const [showOverflow, setShowOverflow] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedTypes, setExpandedTypes] = useState<Set<Event['type']>>(new Set())

  const authorCounts = new Map<string, number>()
  events.forEach(e => {
    const a = eventActor(e)
    if (a !== '?') authorCounts.set(a, (authorCounts.get(a) ?? 0) + 1)
  })
  const authors = Array.from(authorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([author]) => author)
  const highlightedAuthorsList = authors.filter(a => highlightedAuthors.has(a))
  const nonHighlightedAuthors = authors.filter(a => !highlightedAuthors.has(a))
  const visibleAuthors = [...highlightedAuthorsList, ...nonHighlightedAuthors.slice(0, 6)]
  const overflowAuthors = nonHighlightedAuthors.slice(6)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const prevRects = useRef<Map<string, DOMRect>>(new Map())
  const eventsRef = useRef(events)
  eventsRef.current = events

  const [sortedEvents, setSortedEvents] = useState<Event[]>(
    () => sortEvents(events, new Set(), new Set(), new Set(), new Set()),
  )

  useEffect(() => {
    setSortedEvents(sortEvents(events, hiddenIds, highlightedIds, hiddenAuthors, highlightedAuthors))
  }, [events])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(() => {
      itemRefs.current.forEach((el, id) => {
        prevRects.current.set(id, el.getBoundingClientRect())
      })
      setSortedEvents(sortEvents(eventsRef.current, hiddenIds, highlightedIds, hiddenAuthors, highlightedAuthors))
    }, 2000)
    return () => clearTimeout(timer)
  }, [hiddenIds, highlightedIds, hiddenAuthors, highlightedAuthors])

  useLayoutEffect(() => {
    itemRefs.current.forEach((el, id) => {
      const prev = prevRects.current.get(id)
      if (!prev) return
      const next = el.getBoundingClientRect()
      const dy = prev.top - next.top
      if (Math.abs(dy) < 1) return
      el.style.transition = 'none'
      el.style.transform = `translateY(${dy}px)`
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = 'transform 400ms ease'
          el.style.transform = ''
        })
      })
    })
    prevRects.current.clear()
  }, [sortedEvents])

  useEffect(() => {
    const stop = () => { dragRef.current = null }
    window.addEventListener('mouseup', stop)
    return () => window.removeEventListener('mouseup', stop)
  }, [])

  function startDrag(eventId: string, action: 'hide' | 'highlight', e: React.MouseEvent) {
    e.preventDefault()
    const source = action === 'hide' ? hiddenIds : highlightedIds
    const currentlyActive = source.has(eventId)
    const targetState = !currentlyActive
    const virtualState = new Set(source)
    virtualState[targetState ? 'add' : 'delete'](eventId)
    dragRef.current = { action, targetState, processed: new Set([eventId]), virtualState }
    if (action === 'hide') onToggleHide(eventId)
    else onToggleHighlight(eventId)
  }

  function enterDrag(eventId: string, action: 'hide' | 'highlight') {
    const drag = dragRef.current
    if (!drag || drag.action !== action || drag.processed.has(eventId)) return
    drag.processed.add(eventId)
    const isActive = drag.virtualState.has(eventId)
    if (isActive !== drag.targetState) {
      drag.virtualState[drag.targetState ? 'add' : 'delete'](eventId)
      if (action === 'hide') onToggleHide(eventId)
      else onToggleHighlight(eventId)
    }
  }

  return (
    <div className="space-y-3 select-none">
      <p className="text-brand-light text-xs">{authors.length} contributor{authors.length !== 1 ? 's' : ''} over {days} days</p>

      {/* Author filter bar */}
      <div className="relative" onMouseEnter={() => setShowOverflow(true)} onMouseLeave={() => setShowOverflow(false)}>
        <div className="flex flex-wrap gap-2">
          {visibleAuthors.map(author => <AuthorChip key={author} author={author} count={authorCounts.get(author)!} hiddenAuthors={hiddenAuthors} highlightedAuthors={highlightedAuthors} onToggleHide={onToggleHideAuthor} onToggleHighlight={onToggleHighlightAuthor} />)}
          {overflowAuthors.length > 0 && (
            <button className="px-2.5 py-1 rounded-full border border-brand-light/40 bg-brand-surface/30 text-xs text-brand-light hover:text-brand-accent transition-colors">
              +{overflowAuthors.length} more
            </button>
          )}
        </div>
        {showOverflow && overflowAuthors.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-20 pt-1">
            <div className="bg-brand-bg border border-brand-light/30 rounded-lg p-3 flex flex-wrap gap-2 shadow-lg">
              {overflowAuthors.map(author => <AuthorChip key={author} author={author} count={authorCounts.get(author)!} hiddenAuthors={hiddenAuthors} highlightedAuthors={highlightedAuthors} onToggleHide={onToggleHideAuthor} onToggleHighlight={onToggleHighlightAuthor} />)}
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      <input
        type="search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search events or authors…"
        className="w-full bg-transparent border border-brand-light/30 rounded px-3 py-1.5 text-sm text-brand-accent placeholder-brand-light/40 focus:outline-none focus:border-brand-light/60 transition-colors"
      />

      {/* Event rows */}
      {(() => {
        const term = search.trim().toLowerCase()
        const searchPool = term
          ? [...eventsRef.current]
              .filter(e => e.title.toLowerCase().includes(term) || eventActor(e).toLowerCase().includes(term))
              .sort((a, b) => TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type])
          : null
        const globalIds = (searchPool ?? eventsRef.current).map(e => e.id)
        const allHL = globalIds.length > 0 && globalIds.every((id: string) => highlightedIds.has(id))
        const allHid = globalIds.length > 0 && globalIds.every((id: string) => hiddenIds.has(id))

        const grouped = new Map<Event['type'], Event[]>(TYPE_ORDER.map(t => [t, []]))
        for (const e of sortedEvents) grouped.get(e.type)?.push(e)

        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-brand-light flex-1">
                {searchPool ? `${searchPool.length} matching` : events.length} events
              </span>
              <button onClick={() => onBulkHighlight(globalIds, !allHL)} title={allHL ? 'Remove highlight from all' : 'Highlight all'} className={`leading-none transition-colors ${allHL ? 'text-yellow-400 hover:text-brand-light' : 'text-brand-light hover:text-yellow-400'}`}>★ {allHL ? 'unhighlight' : 'highlight'} all</button>
              <button onClick={() => onBulkHide(globalIds, !allHid)} title={allHid ? 'Show all' : 'Hide all'} className={`leading-none transition-colors ${allHid ? 'text-brand-light hover:text-brand-accent' : 'text-brand-light hover:text-red-400'}`}>{allHid ? '👁' : '🚫'} {allHid ? 'show' : 'hide'} all</button>
            </div>

            {searchPool !== null
              ? searchPool.map(event => <EventRow key={event.id} event={event} hiddenIds={hiddenIds} highlightedIds={highlightedIds} hiddenAuthors={hiddenAuthors} highlightedAuthors={highlightedAuthors} itemRefs={itemRefs} startDrag={startDrag} enterDrag={enterDrag} />)
              : TYPE_ORDER.flatMap(type => {
                  const evts = grouped.get(type) ?? []
                  if (!evts.length) return []
                  const typeIds = eventsRef.current.filter(e => e.type === type).map(e => e.id)
                  const expanded = expandedTypes.has(type)
                  const shown = expanded ? evts : evts.slice(0, DEFAULT_PER_TYPE)
                  const hiddenCount = evts.length - shown.length
                  const typeHL = typeIds.length > 0 && typeIds.every((id: string) => highlightedIds.has(id))
                  const typeHid = typeIds.length > 0 && typeIds.every((id: string) => hiddenIds.has(id))
                  return [
                    <div key={`header-${type}`} className="flex items-center justify-between px-1 pt-3 pb-1">
                      <span className="text-xs font-semibold text-brand-light/70 uppercase tracking-wide">{TYPE_LABELS[type]}</span>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => onBulkHighlight(typeIds, !typeHL)} title={typeHL ? 'Remove highlight' : 'Highlight all'} className={`text-sm leading-none transition-colors ${typeHL ? 'text-yellow-400 hover:text-brand-light' : 'text-brand-light/50 hover:text-yellow-400'}`}>★</button>
                        <button onClick={() => onBulkHide(typeIds, !typeHid)} title={typeHid ? 'Show all' : 'Hide all'} className={`text-sm leading-none transition-colors ${typeHid ? 'text-brand-light hover:text-brand-accent' : 'text-brand-light/50 hover:text-red-400'}`}>{typeHid ? '👁' : '🚫'}</button>
                      </div>
                    </div>,
                    ...shown.map(event => <EventRow key={event.id} event={event} hiddenIds={hiddenIds} highlightedIds={highlightedIds} hiddenAuthors={hiddenAuthors} highlightedAuthors={highlightedAuthors} itemRefs={itemRefs} startDrag={startDrag} enterDrag={enterDrag} />),
                    ...(hiddenCount > 0 ? [
                      <button key={`expand-${type}`} onClick={() => setExpandedTypes(prev => { const next = new Set(prev); next.add(type); return next })} className="text-xs text-brand-light/50 hover:text-brand-accent transition-colors pl-1 py-0.5">
                        show all
                      </button>
                    ] : []),
                  ]
                })
            }
          </div>
        )
      })()}
    </div>
  )
}
