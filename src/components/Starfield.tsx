import { useEffect, useMemo, useRef, useState } from 'react'

const STAR_COLORS = [
  { halo: 'sf-halo-w', core: '#ffffff' },
  { halo: 'sf-halo-c', core: '#eef5ff' },
  { halo: 'sf-halo-b', core: '#d2e6ff' },
  { halo: 'sf-halo-v', core: '#ece4ff' },
  { halo: 'sf-halo-warm', core: '#fff1da' },
]

type Star = {
  x: number
  y: number
  core: number
  halo: number
  spike: number
  ci: number
  tw: number
  dur: number
}

function buildStars(w: number, h: number, density: number, seed: number): Star[] {
  let s = seed
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
  const count = Math.round(Math.min(240, Math.max(46, ((w * h) / 9400) * density)))
  const stars: Star[] = []
  for (let i = 0; i < count; i++) {
    const b = rnd()
    const bright = b > 0.88
    const mid = !bright && b > 0.52
    const t = rnd()
    const ci = t > 0.95 ? 4 : t > 0.76 ? 2 : t > 0.52 ? 3 : t > 0.27 ? 1 : 0
    stars.push({
      x: +(rnd() * w).toFixed(1),
      y: +(rnd() * h).toFixed(1),
      core: +(0.45 + b * (bright ? 1.5 : mid ? 0.85 : 0.35)).toFixed(2),
      halo: +(1.8 + b * (bright ? 9 : mid ? 4 : 1.8)).toFixed(2),
      spike: bright ? +(9 + b * 28).toFixed(1) : 0,
      ci,
      tw: rnd(),
      dur: +(3.2 + rnd() * 5).toFixed(1),
    })
  }
  return stars
}

export default function Starfield({
  opacity = 0.55,
  density = 1,
  twinkle = true,
  seed = 20251,
}: {
  opacity?: number
  density?: number
  twinkle?: boolean
  seed?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [dim, setDim] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setDim({ w: el.offsetWidth, h: el.offsetHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const reduce =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const stars = useMemo(
    () => (dim.w && dim.h ? buildStars(dim.w, dim.h, density, seed) : []),
    [dim.w, dim.h, density, seed],
  )

  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        zIndex: 0,
        pointerEvents: 'none',
        opacity,
      }}
    >
      {dim.w > 0 && (
        <svg width={dim.w} height={dim.h} style={{ display: 'block' }}>
          <defs>
            <radialGradient id="sf-halo-w">
              <stop offset="0%" stopColor="#fff" stopOpacity={1} />
              <stop offset="22%" stopColor="#fff" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#fff" stopOpacity={0} />
            </radialGradient>
            <radialGradient id="sf-halo-c">
              <stop offset="0%" stopColor="#fff" stopOpacity={1} />
              <stop offset="28%" stopColor="#cfe2ff" stopOpacity={0.42} />
              <stop offset="100%" stopColor="#9bc2ff" stopOpacity={0} />
            </radialGradient>
            <radialGradient id="sf-halo-b">
              <stop offset="0%" stopColor="#fff" stopOpacity={0.95} />
              <stop offset="26%" stopColor="#8fc1ff" stopOpacity={0.46} />
              <stop offset="100%" stopColor="#3f8bff" stopOpacity={0} />
            </radialGradient>
            <radialGradient id="sf-halo-v">
              <stop offset="0%" stopColor="#fff" stopOpacity={0.95} />
              <stop offset="28%" stopColor="#cdbcff" stopOpacity={0.44} />
              <stop offset="100%" stopColor="#9a7bff" stopOpacity={0} />
            </radialGradient>
            <radialGradient id="sf-halo-warm">
              <stop offset="0%" stopColor="#fff" stopOpacity={1} />
              <stop offset="26%" stopColor="#ffe2b8" stopOpacity={0.48} />
              <stop offset="100%" stopColor="#ffb86b" stopOpacity={0} />
            </radialGradient>
            <linearGradient id="sf-spike-h" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fff" stopOpacity={0} />
              <stop offset="50%" stopColor="#fff" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#fff" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="sf-spike-v" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity={0} />
              <stop offset="50%" stopColor="#fff" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#fff" stopOpacity={0} />
            </linearGradient>
          </defs>
          {stars.map((st, i) => {
            const c = STAR_COLORS[st.ci]
            const anim = twinkle && !reduce && st.spike > 0
            const lo = (0.4 + st.tw * 0.2).toFixed(2)
            return (
              <g
                key={i}
                transform={`translate(${st.x} ${st.y})`}
                opacity={+(0.45 + st.tw * 0.55).toFixed(2)}
              >
                {anim && (
                  <animate
                    attributeName="opacity"
                    values={`${lo};1;${lo}`}
                    dur={`${st.dur}s`}
                    begin={`${(st.tw * 4).toFixed(1)}s`}
                    repeatCount="indefinite"
                  />
                )}
                <circle r={st.halo} fill={`url(#${c.halo})`} />
                {st.spike > 0 && (
                  <g>
                    <rect
                      x={-st.spike}
                      y={-0.45}
                      width={st.spike * 2}
                      height={0.9}
                      fill="url(#sf-spike-h)"
                    />
                    <rect
                      x={-0.45}
                      y={-st.spike}
                      width={0.9}
                      height={st.spike * 2}
                      fill="url(#sf-spike-v)"
                    />
                  </g>
                )}
                <circle r={st.core} fill={c.core} />
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
