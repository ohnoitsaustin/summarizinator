import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { api, type Project, type UpdateSummary, type GithubEvent, type AudienceMode } from '../api/client'
import GenerateButton from '../components/GenerateButton'
import UpdateEditor from '../components/UpdateEditor'
import EventList from '../components/EventList'
import PastUpdateCard from '../components/PastUpdateCard'
import LoadingDots from '../components/LoadingDots'

const AUDIENCE_OPTIONS: { value: AudienceMode; label: string }[] = [
  { value: 'engineering', label: 'Engineering' },
  { value: 'product', label: 'Product' },
  { value: 'executive', label: 'Executive' },
]

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
  const [audience, setAudience] = useState<AudienceMode>('engineering')
  const [context, setContext] = useState('')
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
    api.projects.list()
      .then(projects => setProject(projects.find(p => p.id === id) ?? null))
      .catch(() => setError('Failed to load project'))
    api.updates.list(id)
      .then(list => {
        setUpdates(list)
        if (list.length > 0) {
          setActiveContent(list[0].content)
          setActiveUpdateId(list[0].id)
          setAudience(list[0].audience ?? 'engineering')
          setContext(list[0].generationContext ?? '')
        }
      })
      .catch(() => setError('Failed to load updates'))
    setFetchingEvents(true)
    api.updates.fetchEvents(id, days)
      .then(res => { setAllEvents(res.events); setFetchedDays(res.days) })
      .catch(() => setError('Failed to load events'))
      .finally(() => setFetchingEvents(false))
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
      setError('Failed to load events for the selected range')
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
      const result = await api.updates.generate(id, days, audience, context.trim() || undefined)
      const newUpdate: UpdateSummary = {
        id: result.updateId,
        content: result.content,
        createdAt: new Date().toISOString(),
        events: result.events,
        audience: result.audience,
        generationContext: result.generationContext,
      }
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
        audience,
        context.trim() || undefined,
      )
      const newUpdate: UpdateSummary = {
        id: result.updateId,
        content: result.content,
        createdAt: new Date().toISOString(),
        events: result.events,
        audience: result.audience,
        generationContext: result.generationContext,
      }
      setUpdates(prev => [newUpdate, ...prev])
      setActiveContent(result.content)
      setActiveUpdateId(result.updateId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Regeneration failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSaveUpdate(updateId: string, content: string) {
    if (!project) return
    try {
      await api.updates.patch(updateId, project.id, content)
      setUpdates(prev => prev.map(u => u.id === updateId ? { ...u, content } : u))
    } catch {
      setError('Failed to save update')
    }
  }

  async function handleDeleteUpdate(updateId: string) {
    if (!project) return
    try {
      await api.updates.delete(updateId, project.id)
      setUpdates(prev => prev.filter(u => u.id !== updateId))
    } catch {
      setError('Failed to delete update')
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

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-brand-mid/70 shrink-0">Audience</span>
          <div className="flex rounded overflow-hidden border border-brand-mid/50 text-xs">
            {AUDIENCE_OPTIONS.map(({ value, label }, i) => (
              <button
                key={value}
                onClick={() => setAudience(value)}
                className={`px-3 py-2 transition-colors ${audience === value ? 'bg-brand-mid/40 text-white' : 'text-brand-mid hover:text-white'
                  } ${i > 0 ? 'border-l border-brand-mid/50' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={context}
          onChange={e => setContext(e.target.value)}
          maxLength={1000}
          placeholder="Additional context (optional) — release timing, staffing changes, shifted priorities, known blockers..."
          className="w-full bg-transparent border border-brand-mid/30 rounded px-3 py-2 text-sm text-brand-accent placeholder-brand-mid/40 resize-none focus:outline-none focus:border-brand-mid/60 transition-colors"
          rows={2}
        />

        <div className="flex items-center gap-3 flex-wrap">
          <GenerateButton onClick={handleGenerate} loading={generating} />
          <div className="flex rounded overflow-hidden border border-brand-mid/50 text-xs">
            {SPAN_OPTIONS.map(({ d, label }, i) => (
              <button
                key={d}
                onClick={() => handleDaysChange(d)}
                disabled={fetchingEvents}
                className={`px-3 py-2 transition-colors disabled:opacity-50 ${days === d ? 'bg-brand-mid/40 text-white' : 'text-brand-mid hover:text-white'
                  } ${i > 0 ? 'border-l border-brand-mid/50' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
          {fetchingEvents && <LoadingDots className="text-brand-mid" />}
        </div>
      </div>

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
            <PastUpdateCard
              key={u.id}
              update={u}
              onSave={handleSaveUpdate}
              onDelete={handleDeleteUpdate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
