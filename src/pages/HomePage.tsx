import { useNavigate } from 'react-router-dom'
import { useBackground } from '../contexts/BackgroundContext'

const FADE_DURATION_MS = 1_500

function HomePage() {
  const navigate = useNavigate()
  const { layers, activeLayer } = useBackground()

  const hasBackground = activeLayer !== null

  const backgroundLayerStyle = (index: 0 | 1): React.CSSProperties => ({
    backgroundImage: layers[index] ? `url(${layers[index]})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: 'blur(8px)',
    transform: 'scale(1.1)',
    opacity: activeLayer === index ? 1 : 0,
    transition: `opacity ${FADE_DURATION_MS}ms ease-in-out`,
  })

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-12">
      <div className="absolute inset-0" style={backgroundLayerStyle(0)} />
      <div className="absolute inset-0" style={backgroundLayerStyle(1)} />

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
