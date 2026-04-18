export default function UpdateEditor({ content, onChange }: { content: string; onChange: (v: string) => void }) {
  return (
    <textarea
      value={content}
      onChange={e => onChange(e.target.value)}
      className="w-full h-96 bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
    />
  )
}
