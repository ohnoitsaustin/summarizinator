export default function UpdateEditor({ content, onChange }: { content: string; onChange: (v: string) => void }) {
  return (
    <textarea
      value={content}
      onChange={e => onChange(e.target.value)}
      className="w-full h-96 bg-brand-surface border border-brand-mid/50 rounded-xl p-4 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-brand-accent resize-none"
    />
  )
}
