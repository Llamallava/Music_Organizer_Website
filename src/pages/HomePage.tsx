import { useNavigate } from 'react-router-dom'

function HomePage() {
  const navigate = useNavigate()

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <button
          type="button"
          onClick={() => navigate('/reviews')}
          className="rounded-lg bg-slate-900 px-4 py-3 text-base font-semibold text-white"
        >
          Reviews
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
          onClick={() => navigate('/search')}
          className="rounded-lg bg-slate-600 px-4 py-3 text-base font-semibold text-white"
        >
          Search
        </button>

        <button
          type="button"
          onClick={() => navigate('/friends')}
          className="rounded-lg bg-slate-600 px-4 py-3 text-base font-semibold text-white"
        >
          Friends
        </button>
      </div>
    </main>
  )
}

export default HomePage
