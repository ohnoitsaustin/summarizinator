export default function GenerateButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg font-medium transition-colors"
    >
      {loading ? 'Generating…' : 'Generate Update'}
    </button>
  )
}
