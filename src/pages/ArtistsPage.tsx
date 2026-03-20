import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LinearBackButton from '../components/LinearBackButton'
import { listSavedAlbumsForCurrentUser } from '../lib/db/reviewsData'

function ArtistsPage() {
  const navigate = useNavigate()
  const [artists, setArtists] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    const loadArtists = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const albums = await listSavedAlbumsForCurrentUser()
        if (!isActive) return

        const unique = [...new Set(albums.map((a) => a.artistName))].sort((a, b) =>
          a.localeCompare(b),
        )
        setArtists(unique)
      } catch (error) {
        if (!isActive) return
        const message = error instanceof Error ? error.message : 'Failed to load artists.'
        setErrorMessage(message)
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    void loadArtists()

    return () => {
      isActive = false
    }
  }, [])

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <LinearBackButton />
        </div>

        <h1 className="mt-5 text-3xl font-black text-slate-900">Your Artists</h1>

        {isLoading && (
          <p className="mt-6 rounded-lg bg-white p-4 text-sm text-slate-700">Loading artists...</p>
        )}

        {!isLoading && errorMessage && (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <p>Could not load artists.</p>
            <p className="mt-1">{errorMessage}</p>
          </div>
        )}

        {!isLoading && !errorMessage && artists.length === 0 && (
          <p className="mt-6 text-sm text-slate-600">No artists found. Save some albums first.</p>
        )}

        {!isLoading && !errorMessage && artists.length > 0 && (
          <div className="mt-6 flex flex-col gap-2">
            {artists.map((artist) => (
              <button
                key={artist}
                type="button"
                onClick={() => navigate(`/artists/${encodeURIComponent(artist)}`)}
                className="w-full rounded-xl border border-slate-200 bg-white/90 px-5 py-4 text-left text-base font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
              >
                {artist}
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

export default ArtistsPage
