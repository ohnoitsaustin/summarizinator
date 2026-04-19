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
      className="px-3 py-1 border border-brand-light/50 hover:border-brand-accent text-xs rounded transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}
