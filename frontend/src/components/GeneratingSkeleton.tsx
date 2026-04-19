const LINE_WIDTHS = [
  'w-1/3', 'w-full', 'w-5/6', 'w-4/5',
  'w-2/5', 'w-full', 'w-11/12', 'w-3/4',
  'w-1/4', 'w-full', 'w-5/6', 'w-2/3',
]

export default function GeneratingSkeleton() {
  return (
    <div
      className="rounded-xl p-px animate-shimmer"
      style={{
        background: 'linear-gradient(90deg, #021526 0%, #C9E8FF 45%, #6EACDA 55%, #021526 100%)',
        backgroundSize: '300% 100%',
      }}
    >
      <div className="rounded-[11px] bg-brand-bg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-brand-surface/20 border-b border-brand-light/20">
          <div className="h-4 w-10 rounded bg-brand-light/20 animate-pulse" />
          <div className="flex gap-1">
            <div className="h-5 w-16 rounded bg-brand-light/20 animate-pulse" />
            <div className="h-5 w-16 rounded bg-brand-light/20 animate-pulse" />
          </div>
        </div>
        <div className="h-96 p-4 space-y-2.5 overflow-hidden relative">
          {LINE_WIDTHS.map((w, i) => (
            <div
              key={i}
              className={`h-3 rounded bg-brand-light/10 animate-pulse ${w} ${i === 0 || i === 4 || i === 8 ? 'mb-1 bg-brand-light/20 h-4' : ''}`}
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
          <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-brand-light/50">
            This may take a moment…
          </p>
        </div>
      </div>
    </div>
  )
}
