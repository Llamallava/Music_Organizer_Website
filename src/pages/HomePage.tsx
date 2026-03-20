import { useNavigate } from 'react-router-dom'

function HomePage() {
  const navigate = useNavigate()

  return (
    <main className="flex min-h-screen items-center justify-center px-12">
      <div className="flex w-full max-w-5xl items-center gap-16">
        <div className="flex flex-1 flex-col gap-3">
          <button
            type="button"
            onClick={() => navigate('/reviews')}
            className="rounded-lg bg-slate-900 px-4 py-3 text-base font-semibold text-white"
          >
            My Reviews
          </button>

          <button
            type="button"
            onClick={() => navigate('/search')}
            className="rounded-lg bg-slate-600 px-4 py-3 text-base font-semibold text-white"
          >
            Search
          </button>

          <button
            type="button"
            onClick={() => navigate('/stats')}
            className="rounded-lg bg-slate-600 px-4 py-3 text-base font-semibold text-white"
          >
            My Stats
          </button>

          <button
            type="button"
            onClick={() => navigate('/to-listen')}
            className="rounded-lg bg-slate-600 px-4 py-3 text-base font-semibold text-white"
          >
            To-Listen
          </button>

          <button
            type="button"
            onClick={() => navigate('/playlists')}
            className="rounded-lg bg-slate-600 px-4 py-3 text-base font-semibold text-white"
          >
            Playlists
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <h1 className="text-6xl font-black tracking-tight text-slate-900">Music Organizer</h1>
        </div>
      </div>
    </main>
  )
}

export default HomePage
