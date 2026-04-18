export default function GenerateButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="px-6 py-2 bg-brand-cta text-brand-bg hover:bg-brand-cta/90 disabled:opacity-50 rounded-lg font-semibold transition-colors"
    >
      {loading ? 'Generating…' : 'Generate Update'}
    </button>
  )
}
