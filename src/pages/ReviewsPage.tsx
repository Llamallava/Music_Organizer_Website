import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AlbumCover from '../components/AlbumCover'
import LinearBackButton from '../components/LinearBackButton'
import { listSavedAlbumsForCurrentUser, type SavedAlbumCard } from '../lib/db/reviewsData'

function ReviewsPage() {
  const navigate = useNavigate()
  const [albums, setAlbums] = useState<SavedAlbumCard[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    const loadAlbums = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const savedAlbums = await listSavedAlbumsForCurrentUser()

        if (!isActive) {
          return
        }

        setAlbums(savedAlbums)
      } catch (error) {
        if (!isActive) {
          return
        }

        const message = error instanceof Error ? error.message : 'Failed to load saved albums.'
        setErrorMessage(message)
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadAlbums()

    return () => {
      isActive = false
    }
  }, [])

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex items-center gap-3">
          <LinearBackButton />
          <button
            type="button"
            onClick={() => navigate('/reviews/add')}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Add Album
          </button>
        </div>

        {isLoading && (
          <p className="mt-6 rounded-lg bg-white p-4 text-sm text-slate-700">Loading albums...</p>
        )}

        {!isLoading && errorMessage && (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <p>Could not load albums.</p>
            <p className="mt-1">{errorMessage}</p>
          </div>
        )}

        {!isLoading && !errorMessage && albums.length === 0 && (
          <p className="mt-6 rounded-lg bg-white p-4 text-sm text-slate-700">
            No albums saved yet. Use `Add Album` to add your first album.
          </p>
        )}

        {!isLoading && !errorMessage && albums.length > 0 && (
          <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {albums.map((album) => (
              <button
                key={album.userSavedAlbumId}
                type="button"
                onClick={() => navigate(`/reviews/${album.userSavedAlbumId}`)}
                className="text-left"
              >
                <div className="aspect-square w-full overflow-hidden rounded-lg bg-slate-200">
                  <AlbumCover src={album.coverUrl} alt={`${album.title} cover`} loading="lazy" />
                </div>

                <p className="mt-2 truncate text-sm font-semibold text-slate-900">{album.title}</p>
                <p className="truncate text-xs text-slate-600">{album.artistName}</p>
              </button>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}

export default ReviewsPage
