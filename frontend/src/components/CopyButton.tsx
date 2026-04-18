import { useState } from 'react'

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="px-4 py-2 border border-slate-700 hover:border-slate-500 rounded-lg text-sm transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}
