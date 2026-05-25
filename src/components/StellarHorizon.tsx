export function StellarHorizon({ label = 'RA · 14h 27m' }: { label?: string }) {
  return (
    <div
      className="relative my-5 h-px"
      style={{
        background:
          'linear-gradient(90deg, transparent 0%, rgba(196,181,253,0.35) 18%, rgba(196,181,253,0.5) 50%, rgba(196,181,253,0.35) 82%, transparent 100%)',
      }}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
        <span
          key={i}
          className="absolute -top-0.5 block h-[5px] w-px"
          style={{
            left: `${t * 100}%`,
            background: 'rgba(196,181,253,0.55)',
            transform: 'translateX(-0.5px)',
          }}
        />
      ))}
      <span className="absolute -top-2.5 right-0 hidden sm:block font-mono text-[9px] uppercase tracking-[1.5px] text-ink-3">
        {label}
      </span>
    </div>
  )
}
