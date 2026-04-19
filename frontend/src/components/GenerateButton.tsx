import LoadingDots from './LoadingDots'

export default function GenerateButton({ onClick, loading, allHidden = false }: { onClick: () => void; loading: boolean; allHidden?: boolean }) {
  const disabled = loading || allHidden
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={allHidden ? 'All events are hidden — nothing to report' : undefined}
      className="px-6 py-2 bg-brand-cta text-brand-bg hover:bg-brand-cta/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
    >
      {loading ? <LoadingDots /> : 'Generate Summary'}
    </button>
  )
}
