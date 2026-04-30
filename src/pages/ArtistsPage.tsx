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

        <h1 className="mt-5 text-3xl font-black text-ink">Your Artists</h1>

        {isLoading && (
          <p className="mt-6 rounded-lg bg-surface p-4 text-sm text-ink">Loading artists...</p>
        )}

        {!isLoading && errorMessage && (
          <div className="mt-6 rounded-lg border border-err-edge bg-err-bg p-4 text-sm text-err">
            <p>Could not load artists.</p>
            <p className="mt-1">{errorMessage}</p>
          </div>
        )}

        {!isLoading && !errorMessage && artists.length === 0 && (
          <p className="mt-6 text-sm text-ink-2">No artists found. Save some albums first.</p>
        )}

        {!isLoading && !errorMessage && artists.length > 0 && (
          <div className="mt-6 flex flex-col gap-2">
            {artists.map((artist) => (
              <button
                key={artist}
                type="button"
                onClick={() => navigate(`/artists/${encodeURIComponent(artist)}`)}
                className="w-full rounded-xl border border-edge bg-surface px-5 py-4 text-left text-base font-semibold text-ink shadow-sm hover:bg-surface-2"
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
