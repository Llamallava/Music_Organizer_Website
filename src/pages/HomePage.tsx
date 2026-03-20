import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBackground } from '../contexts/BackgroundContext'

const FADE_DURATION_MS = 1_500

// Drift animation constants
const MAX_OFFSET = 3.5   // max % translation in any direction
const MAX_SPEED = 0.012  // max % per frame
const NOISE = 0.0007     // random kick per frame
const DAMPING = 0.988    // velocity damping
const SPRING = 0.0003    // pull back toward center

function HomePage() {
  const navigate = useNavigate()
  const { layers, activeLayer } = useBackground()

  const layer0Ref = useRef<HTMLDivElement>(null)
  const layer1Ref = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const drift = useRef({ x: 0, y: 0, vx: 0.006, vy: 0.004 })

  useEffect(() => {
    const tick = () => {
      const d = drift.current

      // Random nudge
      d.vx += (Math.random() - 0.5) * NOISE
      d.vy += (Math.random() - 0.5) * NOISE

      // Spring toward center
      d.vx -= d.x * SPRING
      d.vy -= d.y * SPRING

      // Dampen
      d.vx *= DAMPING
      d.vy *= DAMPING

      // Clamp speed
      const speed = Math.sqrt(d.vx * d.vx + d.vy * d.vy)
      if (speed > MAX_SPEED) {
        d.vx = (d.vx / speed) * MAX_SPEED
        d.vy = (d.vy / speed) * MAX_SPEED
      }

      d.x = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, d.x + d.vx))
      d.y = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, d.y + d.vy))

      const t = `scale(1.15) translate(${d.x}%, ${d.y}%)`
      if (layer0Ref.current) layer0Ref.current.style.transform = t
      if (layer1Ref.current) layer1Ref.current.style.transform = t

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  const hasBackground = activeLayer !== null

  // transform is intentionally omitted here — the animation loop owns it
  const backgroundLayerStyle = (index: 0 | 1): React.CSSProperties => ({
    backgroundImage: layers[index] ? `url(${layers[index]})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: 'blur(8px)',
    willChange: 'transform',
    opacity: activeLayer === index ? 1 : 0,
    transition: `opacity ${FADE_DURATION_MS}ms ease-in-out`,
  })

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-12">
      <div ref={layer0Ref} className="absolute inset-0" style={backgroundLayerStyle(0)} />
      <div ref={layer1Ref} className="absolute inset-0" style={backgroundLayerStyle(1)} />

      {hasBackground && <div className="absolute inset-0 bg-black/50" />}

      <div className="relative z-10 flex w-full max-w-5xl items-center gap-16">
        <div className="flex flex-1 flex-col gap-3">
          <button
            type="button"
            onClick={() => navigate('/reviews')}
            className={
              hasBackground
                ? 'rounded-lg border border-white/20 bg-white/15 px-4 py-3 text-base font-semibold text-white backdrop-blur-sm hover:bg-white/25'
                : 'rounded-lg bg-slate-900 px-4 py-3 text-base font-semibold text-white'
            }
          >
            My Reviews
          </button>

          <button
            type="button"
            onClick={() => navigate('/search')}
            className={
              hasBackground
                ? 'rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-base font-semibold text-white backdrop-blur-sm hover:bg-white/20'
                : 'rounded-lg bg-slate-600 px-4 py-3 text-base font-semibold text-white'
            }
          >
            Search
          </button>

          <button
            type="button"
            onClick={() => navigate('/stats')}
            className={
              hasBackground
                ? 'rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-base font-semibold text-white backdrop-blur-sm hover:bg-white/20'
                : 'rounded-lg bg-slate-600 px-4 py-3 text-base font-semibold text-white'
            }
          >
            My Stats
          </button>

          <button
            type="button"
            onClick={() => navigate('/to-listen')}
            className={
              hasBackground
                ? 'rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-base font-semibold text-white backdrop-blur-sm hover:bg-white/20'
                : 'rounded-lg bg-slate-600 px-4 py-3 text-base font-semibold text-white'
            }
          >
            To-Listen
          </button>

          <button
            type="button"
            onClick={() => navigate('/playlists')}
            className={
              hasBackground
                ? 'rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-base font-semibold text-white backdrop-blur-sm hover:bg-white/20'
                : 'rounded-lg bg-slate-600 px-4 py-3 text-base font-semibold text-white'
            }
          >
            Playlists
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <h1
            className={`text-6xl font-black tracking-tight ${hasBackground ? 'text-white drop-shadow-lg' : 'text-slate-900'}`}
          >
            Music Organizer
          </h1>
        </div>
      </div>
    </main>
  )
}

export default HomePage
