import { useNavigate, useParams } from 'react-router-dom'

function AlbumReviewPage() {
  const navigate = useNavigate()
  const { userSavedAlbumId } = useParams()

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
          <h1 className="text-2xl font-bold text-slate-900">Album Review</h1>
          <p className="mt-2 text-slate-700">
            Review workspace is coming next. Selected album id: {userSavedAlbumId ?? 'unknown'}
          </p>
        </section>
      </div>
    </main>
  )
}

export default AlbumReviewPage
