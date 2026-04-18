import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { api, type Project, type UpdateSummary, type GithubEvent } from '../api/client'
import GenerateButton from '../components/GenerateButton'
import UpdateEditor from '../components/UpdateEditor'
import EventList from '../components/EventList'

function inferFetchedDays(events: GithubEvent[]): number {
  if (events.length === 0) return 0
  const oldest = Math.min(...events.map(e => new Date(e.createdAt).getTime()))
  return Math.ceil((Date.now() - oldest) / (24 * 60 * 60 * 1000))
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()

  const [project, setProject] = useState<Project | null>(null)
  const [updates, setUpdates] = useState<UpdateSummary[]>([])
  const [activeContent, setActiveContent] = useState('')
  const [activeUpdateId, setActiveUpdateId] = useState<string | null>(null)
  const [allEvents, setAllEvents] = useState<GithubEvent[]>([])
  const [fetchedDays, setFetchedDays] = useState(0)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set())
  const [hiddenAuthors, setHiddenAuthors] = useState<Set<string>>(new Set())
  const [highlightedAuthors, setHighlightedAuthors] = useState<Set<string>>(new Set())
  const [days, setDays] = useState(7)
  const [generating, setGenerating] = useState(false)
  const [fetchingEvents, setFetchingEvents] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const events = useMemo(
    () => allEvents.filter(e => e.createdAt >= since),
    [allEvents, since],
  )

  useEffect(() => {
    if (!id) return
    api.projects.list().then(projects => setProject(projects.find(p => p.id === id) ?? null))
    api.updates.list(id).then(list => {
      setUpdates(list)
      if (list.length > 0) {
        setActiveContent(list[0].content)
        setActiveUpdateId(list[0].id)
        const loaded = list[0].events ?? []
        setAllEvents(loaded)
        setFetchedDays(inferFetchedDays(loaded))
      }
    })
  }, [id])

  async function handleDaysChange(newDays: number) {
    setDays(newDays)
    if (!id || newDays <= fetchedDays) return
    setFetchingEvents(true)
    try {
      const res = await api.updates.fetchEvents(id, newDays)
      setAllEvents(res.events)
      setFetchedDays(newDays)
    } catch {
      // keep existing events on error
    } finally {
      setFetchingEvents(false)
    }
  }

  function toggleHide(eventId: string) {
    setHiddenIds(prev => {
      const next = new Set(prev)
      if (next.has(eventId)) next.delete(eventId)
      else { next.add(eventId); setHighlightedIds(h => { const hn = new Set(h); hn.delete(eventId); return hn }) }
      return next
    })
  }

  function toggleHighlight(eventId: string) {
    setHighlightedIds(prev => {
      const next = new Set(prev)
      if (next.has(eventId)) next.delete(eventId)
      else next.add(eventId)
      return next
    })
  }

  function toggleHideAuthor(author: string) {
    setHiddenAuthors(prev => {
      const next = new Set(prev)
      if (next.has(author)) next.delete(author)
      else { next.add(author); setHighlightedAuthors(h => { const hn = new Set(h); hn.delete(author); return hn }) }
      return next
    })
  }

  function toggleHighlightAuthor(author: string) {
    setHighlightedAuthors(prev => {
      const next = new Set(prev)
      if (next.has(author)) next.delete(author)
      else next.add(author)
      return next
    })
  }

  function resetCuration() {
    setHiddenIds(new Set())
    setHighlightedIds(new Set())
    setHiddenAuthors(new Set())
    setHighlightedAuthors(new Set())
  }

  function effectiveHiddenIds() {
    return new Set([
      ...hiddenIds,
      ...events.filter(e => hiddenAuthors.has(e.author)).map(e => e.id),
    ])
  }

  function effectiveHighlightedIds() {
    const hidden = effectiveHiddenIds()
    return new Set([
      ...highlightedIds,
      ...events.filter(e => highlightedAuthors.has(e.author) && !hidden.has(e.id)).map(e => e.id),
    ])
  }

  async function handleGenerate() {
    if (!id) return
    setGenerating(true)
    setError(null)
    resetCuration()
    try {
      const result = await api.updates.generate(id, days)
      const newUpdate: UpdateSummary = { id: result.updateId, content: result.content, createdAt: new Date().toISOString(), events: result.events }
      setUpdates(prev => [newUpdate, ...prev])
      setActiveContent(result.content)
      setActiveUpdateId(result.updateId)
      setAllEvents(result.events)
      setFetchedDays(days)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handleRegenerate() {
    if (!id || !activeUpdateId) return
    setGenerating(true)
    setError(null)
    try {
      const result = await api.updates.regenerate(
        activeUpdateId,
        id,
        Array.from(effectiveHiddenIds()),
        Array.from(effectiveHighlightedIds()),
        days,
      )
      const newUpdate: UpdateSummary = { id: result.updateId, content: result.content, createdAt: new Date().toISOString(), events: result.events }
      setUpdates(prev => [newUpdate, ...prev])
      setActiveContent(result.content)
      setActiveUpdateId(result.updateId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Regeneration failed')
    } finally {
      setGenerating(false)
    }
  }

  const SPAN_OPTIONS = [
    { d: 7, label: 'Weekly' },
    { d: 14, label: 'Bi-Weekly' },
    { d: 30, label: 'Monthly' },
    { d: 90, label: 'Quarterly' },
  ]

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      {project && (
        <div>
          <h2 className="text-xl font-semibold">{project.name}</h2>
          <p className="text-brand-accent/60 text-sm">{project.repoOwner}/{project.repoName}</p>
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <GenerateButton onClick={handleGenerate} loading={generating} />
        <div className="flex rounded overflow-hidden border border-brand-mid/50 text-xs">
          {SPAN_OPTIONS.map(({ d, label }, i) => (
            <button
              key={d}
              onClick={() => handleDaysChange(d)}
              disabled={fetchingEvents}
              className={`px-3 py-2 transition-colors disabled:opacity-50 ${
                days === d ? 'bg-brand-mid/40 text-white' : 'text-brand-mid hover:text-white'
              } ${i > 0 ? 'border-l border-brand-mid/50' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
        {fetchingEvents && <span className="text-xs text-brand-mid">Loading events…</span>}
      </div>

      {events.length > 0 && (
        <EventList
          events={events}
          hiddenIds={hiddenIds}
          highlightedIds={highlightedIds}
          hiddenAuthors={hiddenAuthors}
          highlightedAuthors={highlightedAuthors}
          onToggleHide={toggleHide}
          onToggleHighlight={toggleHighlight}
          onToggleHideAuthor={toggleHideAuthor}
          onToggleHighlightAuthor={toggleHighlightAuthor}
        />
      )}

      {activeContent && (
        <UpdateEditor
          content={activeContent}
          onChange={setActiveContent}
          onRegenerate={handleRegenerate}
          regenerating={generating}
        />
      )}

      {updates.length > 1 && (
        <div className="space-y-2">
          <p className="text-brand-mid text-sm">Past updates</p>
          {updates.slice(1).map(u => (
            <button
              key={u.id}
              onClick={() => {
                setActiveContent(u.content)
                setActiveUpdateId(u.id)
                const loaded = u.events ?? []
                setAllEvents(loaded)
                setFetchedDays(inferFetchedDays(loaded))
                resetCuration()
              }}
              className="w-full text-left px-4 py-3 bg-brand-surface hover:bg-brand-mid/30 border border-brand-mid/50 rounded-lg text-sm text-brand-accent/70 transition-colors"
            >
              {new Date(u.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
