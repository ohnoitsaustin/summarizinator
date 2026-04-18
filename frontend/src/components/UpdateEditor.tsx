import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import CopyButton from './CopyButton'

type Props = {
  content: string
  onChange: (v: string) => void
  onRegenerate?: () => void
  regenerating?: boolean
}

export default function UpdateEditor({ content, onChange, onRegenerate, regenerating }: Props) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')

  return (
    <div className="rounded-xl border border-brand-mid/50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-brand-surface border-b border-brand-mid/50">
        <div className="flex items-center gap-2">
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={regenerating}
              className="px-3 py-1 border border-brand-mid/50 hover:border-brand-accent disabled:opacity-50 rounded text-xs transition-colors"
            >
              {regenerating ? 'Regenerating…' : 'Regenerate'}
            </button>
          )}
          <CopyButton text={content} />
        </div>
        <div className="flex rounded overflow-hidden border border-brand-mid/50 text-xs">
          <button
            onClick={() => setMode('edit')}
            className={`px-3 py-1 transition-colors ${mode === 'edit' ? 'bg-brand-mid/40 text-white' : 'text-brand-mid hover:text-white'}`}
          >
            Markdown
          </button>
          <button
            onClick={() => setMode('preview')}
            className={`px-3 py-1 transition-colors ${mode === 'preview' ? 'bg-brand-mid/40 text-white' : 'text-brand-mid hover:text-white'}`}
          >
            Preview
          </button>
        </div>
      </div>

      {mode === 'edit' ? (
        <textarea
          value={content}
          onChange={e => onChange(e.target.value)}
          className="w-full h-96 bg-brand-bg p-4 text-sm font-mono text-white focus:outline-none resize-none"
        />
      ) : (
        <div className="h-96 overflow-y-auto bg-brand-bg p-4 text-sm text-brand-accent prose prose-invert prose-sm max-w-none
          [&_h2]:text-white [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2
          [&_h3]:text-brand-accent [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1
          [&_ul]:space-y-1 [&_li]:text-brand-accent/90 [&_p]:text-brand-accent/90">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}
