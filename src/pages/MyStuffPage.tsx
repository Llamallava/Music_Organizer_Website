import { useNavigate } from 'react-router-dom'
import LinearBackButton from '../components/LinearBackButton'

function MyStuffPage() {
  const navigate = useNavigate()

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <LinearBackButton />

        <button
          type="button"
          onClick={() => navigate('/reviews')}
          className="rounded-lg bg-cta px-4 py-3 text-base font-semibold text-white"
        >
          My Reviews
        </button>

        <button
          type="button"
          onClick={() => navigate('/search')}
          className="rounded-lg bg-surface-2 px-4 py-3 text-base font-semibold text-ink hover:bg-surface-3"
        >
          Search
        </button>

        <button
          type="button"
          onClick={() => navigate('/stats')}
          className="rounded-lg bg-surface-2 px-4 py-3 text-base font-semibold text-ink hover:bg-surface-3"
        >
          My Stats
        </button>

        <button
          type="button"
          onClick={() => navigate('/to-listen')}
          className="rounded-lg bg-surface-2 px-4 py-3 text-base font-semibold text-ink hover:bg-surface-3"
        >
          To-Listen
        </button>

        <button
          type="button"
          onClick={() => navigate('/playlists')}
          className="rounded-lg bg-surface-2 px-4 py-3 text-base font-semibold text-ink hover:bg-surface-3"
        >
          Playlists
        </button>
      </div>
    </main>
  )
}

export default MyStuffPage
