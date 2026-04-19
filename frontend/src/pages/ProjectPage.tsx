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

function defaultSaveName(): string {
  const now = new Date()
  return `${now.getMonth() + 1}/${now.getDate()} update`
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()

  const [project, setProject] = useState<Project | null>(null)
  const [updates, setUpdates] = useState<UpdateSummary[]>([])
  const [activeContent, setActiveContent] = useState('')
  const [activeEvents, setActiveEvents] = useState<GithubEvent[]>([])
  const [allEvents, setAllEvents] = useState<GithubEvent[]>([])
  const [fetchedDays, setFetchedDays] = useState(0)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set())
  const [hiddenAuthors, setHiddenAuthors] = useState<Set<string>>(new Set())
  const [highlightedAuthors, setHighlightedAuthors] = useState<Set<string>>(new Set())
  const [days, setDays] = useState(7)
  const [customMode, setCustomMode] = useState(false)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [audience, setAudience] = useState<AudienceMode>('engineering')
  const [context, setContext] = useState('')
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [fetchingEvents, setFetchingEvents] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSave, setShowSave] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingProject, setEditingProject] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', repoOwner: '', repoName: '' })
  const [savingProject, setSavingProject] = useState(false)

  const since = useMemo(() => {
    if (customMode && customStart) return new Date(customStart).toISOString()
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  }, [customMode, customStart, days])

  const until = useMemo(() => {
    if (customMode && customEnd) return new Date(customEnd + 'T23:59:59.999Z').toISOString()
    return undefined
  }, [customMode, customEnd])

  const effectiveDays = customMode && customStart
    ? Math.max(1, Math.ceil((Date.now() - new Date(customStart).getTime()) / 86400000))
    : days

  const events = useMemo(
    () => allEvents.filter(e => e.createdAt >= since && (!until || e.createdAt <= until)),
    [allEvents, since, until],
  )

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      api.projects.list(),
      api.updates.list(id),
      api.updates.fetchEvents(id, days),
    ])
      .then(([projects, list, eventsRes]) => {
        setProject(projects.find(p => p.id === id) ?? null)
        setUpdates(list)
        if (list.length > 0) {
          setAudience(list[0].audience ?? 'engineering')
          setContext(list[0].generationContext ?? '')
        }
        setAllEvents(eventsRes.events)
        setFetchedDays(eventsRes.days)
      })
      .catch(() => setError('Failed to load project data'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleDaysChange(newDays: number) {
    setCustomMode(false)
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

  function enterCustomMode() {
    const start = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
    const end = new Date().toISOString().slice(0, 10)
    setCustomStart(prev => prev || start)
    setCustomEnd(prev => prev || end)
    setCustomMode(true)
  }

  async function handleCustomStart(start: string) {
    setCustomStart(start)
    if (!id || !start) return
    const needed = Math.max(1, Math.ceil((Date.now() - new Date(start).getTime()) / 86400000))
    if (needed <= fetchedDays) return
    setFetchingEvents(true)
    try {
      const res = await api.updates.fetchEvents(id, needed)
      setAllEvents(res.events)
      setFetchedDays(needed)
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

  function handleBulkHighlight(ids: string[], value: boolean) {
    setHighlightedIds(prev => {
      const next = new Set(prev)
      ids.forEach(id => value ? next.add(id) : next.delete(id))
      return next
    })
    if (value) {
      setHiddenIds(prev => {
        const next = new Set(prev)
        ids.forEach(id => next.delete(id))
        return next
      })
    }
  }

  function handleBulkHide(ids: string[], value: boolean) {
    setHiddenIds(prev => {
      const next = new Set(prev)
      ids.forEach(id => value ? next.add(id) : next.delete(id))
      return next
    })
    if (value) {
      setHighlightedIds(prev => {
        const next = new Set(prev)
        ids.forEach(id => next.delete(id))
        return next
      })
    }
  }

  async function handleGenerate() {
    if (!id) return
    setGenerating(true)
    setError(null)
    setShowSave(false)
    try {
      const effectiveHighlightedIds = events
        .filter(e => highlightedIds.has(e.id) || highlightedAuthors.has(e.author))
        .map(e => e.id)
      const result = await api.updates.generate(id, effectiveDays, audience, context.trim() || undefined, [...hiddenIds], effectiveHighlightedIds)
      setActiveContent(result.content)
      setActiveEvents(result.events)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  function openSave() {
    setSaveName(defaultSaveName())
    setShowSave(true)
  }

  async function handleSave() {
    if (!id || !project || !saveName.trim()) return
    setSaving(true)
    setError(null)
    try {
      const saved = await api.updates.save(
        id,
        saveName.trim(),
        activeContent,
        activeEvents,
        audience,
        context.trim() || undefined,
      )
      setUpdates(prev => [saved, ...prev])
      setShowSave(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleEditSavedUpdate(updateId: string, content: string) {
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

  async function handleSaveProject(e: React.FormEvent) {
    e.preventDefault()
    if (!project) return
    setSavingProject(true)
    try {
      const updated = await api.projects.patch(project.id, editForm)
      setProject(updated)
      setEditingProject(false)
    } catch {
      setError('Failed to save project')
    } finally {
      setSavingProject(false)
    }
  }

  const SPAN_OPTIONS = [
    { d: 7, label: 'Weekly' },
    { d: 14, label: 'Bi-Weekly' },
    { d: 30, label: 'Monthly' },
    { d: 90, label: 'Quarterly' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingDots className="text-brand-mid" />
      </div>
    )
  }

  return (
    <div className="px-6 py-10 max-w-screen-xl mx-auto">
      {project && (
        <div className="mb-6">
          {editingProject ? (
            <form onSubmit={handleSaveProject} className="space-y-1.5">
              <input
                required autoFocus
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Project name"
                className="bg-transparent border-b border-brand-mid/50 focus:border-brand-accent text-xl font-semibold focus:outline-none w-64 transition-colors block"
              />
              <div className="flex items-center gap-1">
                <input
                  required
                  value={editForm.repoOwner}
                  onChange={e => setEditForm(f => ({ ...f, repoOwner: e.target.value }))}
                  placeholder="owner"
                  className="bg-transparent border-b border-brand-mid/50 focus:border-brand-accent text-sm focus:outline-none w-28 text-brand-accent/60 transition-colors"
                />
                <span className="text-brand-accent/40 text-sm">/</span>
                <input
                  required
                  value={editForm.repoName}
                  onChange={e => setEditForm(f => ({ ...f, repoName: e.target.value }))}
                  placeholder="repo"
                  className="bg-transparent border-b border-brand-mid/50 focus:border-brand-accent text-sm focus:outline-none w-28 text-brand-accent/60 transition-colors"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={savingProject} className="px-2.5 py-1 bg-brand-accent hover:bg-brand-accent/80 disabled:opacity-50 rounded text-xs text-brand-bg font-medium transition-colors">
                  {savingProject ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={() => setEditingProject(false)} className="px-2 py-1 text-brand-mid hover:text-white text-xs transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-start gap-3 group">
              <div>
                <h2 className="text-xl font-semibold">{project.name}</h2>
                <a href={`https://github.com/${project.repoOwner}/${project.repoName}`} target="_blank" rel="noreferrer" className="text-brand-accent/60 hover:text-brand-accent text-sm transition-colors">{project.repoOwner}/{project.repoName}</a>
              </div>
              <button
                onClick={() => { setEditForm({ name: project.name, repoOwner: project.repoOwner, repoName: project.repoName }); setEditingProject(true) }}
                className="mt-1 text-brand-mid/30 hover:text-brand-mid opacity-0 group-hover:opacity-100 transition-all text-sm"
                title="Edit project"
              >
                ✎
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-sm mb-6">{error}</p>}

      <div className="flex flex-col lg:flex-row lg:gap-8">
        {events.length > 0 && (
          <div className="lg:w-1/3 shrink-0 mb-6 lg:mb-0 lg:self-start lg:sticky lg:top-6">
            <EventList
              events={events}
              days={days}
              hiddenIds={hiddenIds}
              highlightedIds={highlightedIds}
              hiddenAuthors={hiddenAuthors}
              highlightedAuthors={highlightedAuthors}
              onToggleHide={toggleHide}
              onToggleHighlight={toggleHighlight}
              onToggleHideAuthor={toggleHideAuthor}
              onToggleHighlightAuthor={toggleHighlightAuthor}
              onBulkHighlight={handleBulkHighlight}
              onBulkHide={handleBulkHide}
            />
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-6">
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
              <GenerateButton
                onClick={handleGenerate}
                loading={generating}
                allHidden={events.length > 0 && events.every(e => hiddenIds.has(e.id) || hiddenAuthors.has(e.author))}
              />
              <div className="flex rounded overflow-hidden border border-brand-mid/50 text-xs">
                {SPAN_OPTIONS.map(({ d, label }, i) => (
                  <button
                    key={d}
                    onClick={() => handleDaysChange(d)}
                    disabled={fetchingEvents}
                    className={`px-3 py-2 transition-colors disabled:opacity-50 ${!customMode && days === d ? 'bg-brand-mid/40 text-white' : 'text-brand-mid hover:text-white'
                      } ${i > 0 ? 'border-l border-brand-mid/50' : ''}`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  onClick={enterCustomMode}
                  disabled={fetchingEvents}
                  className={`px-3 py-2 border-l border-brand-mid/50 transition-colors disabled:opacity-50 ${customMode ? 'bg-brand-mid/40 text-white' : 'text-brand-mid hover:text-white'}`}
                >
                  Custom
                </button>
              </div>
              {customMode && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customStart}
                    max={customEnd || new Date().toISOString().slice(0, 10)}
                    onChange={e => handleCustomStart(e.target.value)}
                    className="bg-transparent border border-brand-mid/30 rounded px-2 py-1 text-sm text-brand-accent focus:outline-none focus:border-brand-mid/60 transition-colors"
                  />
                  <span className="text-brand-mid text-xs">to</span>
                  <input
                    type="date"
                    value={customEnd}
                    min={customStart}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={e => setCustomEnd(e.target.value)}
                    className="bg-transparent border border-brand-mid/30 rounded px-2 py-1 text-sm text-brand-accent focus:outline-none focus:border-brand-mid/60 transition-colors"
                  />
                </div>
              )}
              {fetchingEvents && <LoadingDots className="text-brand-mid" />}
            </div>
          </div>

          {activeContent && (
            <>
              <UpdateEditor
                content={activeContent}
                onChange={setActiveContent}
              />

              {showSave ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setShowSave(false) }}
                    className="flex-1 bg-transparent border border-brand-mid/50 rounded px-3 py-1.5 text-sm text-brand-accent placeholder-brand-mid/40 focus:outline-none focus:border-brand-mid transition-colors"
                    placeholder="Update name"
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving || !saveName.trim()}
                    className="px-3 py-1.5 bg-brand-accent text-brand-bg text-xs font-medium rounded hover:bg-brand-accent/80 disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setShowSave(false)}
                    className="px-3 py-1.5 text-brand-mid text-xs hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={openSave}
                  className="text-xs text-brand-mid hover:text-brand-accent transition-colors"
                >
                  Save to archive
                </button>
              )}
            </>
          )}

          {updates.length > 0 && (
            <div className="space-y-2">
              <p className="text-brand-mid text-sm">Archive</p>
              {updates.map(u => (
                <PastUpdateCard
                  key={u.id}
                  update={u}
                  onSave={handleEditSavedUpdate}
                  onDelete={handleDeleteUpdate}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
