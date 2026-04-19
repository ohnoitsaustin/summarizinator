import { useState, useRef } from 'react'
import type { UpdateSummary } from '../api/client'

type Props = {
  update: UpdateSummary
  onSave: (id: string, content: string) => void
  onDelete: (id: string) => void
}

const UNDO_MS = 5000

export default function PastUpdateCard({ update, onSave, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(update.content)
  const [pendingDelete, setPendingDelete] = useState(false)
  const [undoProgress, setUndoProgress] = useState(100)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const undoInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  const dateLabel = update.name || new Date(update.createdAt).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  function startDelete() {
    setPendingDelete(true)
    setUndoProgress(100)
    const start = Date.now()
    undoInterval.current = setInterval(() => {
      setUndoProgress(Math.max(0, 100 - ((Date.now() - start) / UNDO_MS) * 100))
    }, 50)
    undoTimer.current = setTimeout(() => {
      clearInterval(undoInterval.current!)
      onDelete(update.id)
    }, UNDO_MS)
  }

  function handleUndo() {
    clearTimeout(undoTimer.current!)
    clearInterval(undoInterval.current!)
    setPendingDelete(false)
  }

  function handleSave() {
    onSave(update.id, editContent)
    setEditing(false)
  }

  function handleEdit() {
    setEditContent(update.content)
    setEditing(true)
    setExpanded(true)
  }

  if (pendingDelete) {
    return (
      <div className="relative overflow-hidden flex items-center justify-between px-4 py-3 border border-brand-light/30 rounded-lg text-sm bg-brand-surface/20 opacity-60">
        <div
          className="absolute inset-0 bg-red-900/20 origin-left transition-none"
          style={{ transform: `scaleX(${undoProgress / 100})` }}
        />
        <span className="relative text-brand-light">{dateLabel} — deleted</span>
        <button onClick={handleUndo} className="relative text-xs text-brand-accent hover:text-white transition-colors">
          Undo
        </button>
      </div>
    )
  }

  return (
    <div className="border border-brand-light/50 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-brand-surface/20">
        <button
          onClick={() => { setExpanded(v => !v); if (editing) setEditing(false) }}
          className="flex-1 text-left text-sm text-brand-accent/70 flex items-center gap-2 hover:text-brand-accent transition-colors"
        >
          <span className={`text-brand-light text-xs transition-transform inline-block ${expanded ? 'rotate-90' : ''}`}>▶</span>
          {dateLabel}
        </button>
        <button
          onClick={handleEdit}
          className="text-xs text-brand-light hover:text-white transition-colors px-2 py-1"
        >
          Edit
        </button>
        <button
          onClick={startDelete}
          className="text-xs text-brand-light hover:text-red-400 transition-colors px-2 py-1"
        >
          Delete
        </button>
      </div>

      {expanded && (
        <div className="border-t border-brand-light/30">
          {editing ? (
            <div className="p-3 space-y-2">
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="w-full h-64 bg-brand-bg p-3 text-sm font-mono text-white focus:outline-none resize-none rounded"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="px-3 py-1 bg-brand-accent text-brand-bg text-xs font-medium rounded hover:bg-brand-accent/80 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-3 py-1 text-brand-light text-xs hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 text-sm text-brand-accent/80 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
              {update.content}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
