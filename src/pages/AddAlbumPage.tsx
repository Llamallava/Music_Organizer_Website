import { useNavigate } from 'react-router-dom'

function AddAlbumPage() {
  const navigate = useNavigate()

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto w-full max-w-6xl">
        <button
          type="button"
          onClick={() => navigate('/reviews')}
          className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-900"
        >
          Back to Reviews
        </button>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-bold text-slate-900">Add Album</h1>
          <p className="mt-2 text-slate-700">Search and save flow will be added in the next milestone.</p>
        </section>
      </div>
    </main>
  )
}

export default AddAlbumPage
