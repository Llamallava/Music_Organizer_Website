import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AlbumCover from '../components/AlbumCover'
import LinearBackButton from '../components/LinearBackButton'
import { listSavedAlbumsForCurrentUser } from '../lib/db/reviewsData'
import { getArtistImageUrls } from '../lib/external/spotifyArtistImages'

function ArtistsPage() {
  const navigate = useNavigate()
  const [artists, setArtists] = useState<string[]>([])
  const [artistImages, setArtistImages] = useState<Map<string, string | null>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let isActive = true

    const loadArtists = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const albums = await listSavedAlbumsForCurrentUser()
        if (!isActive) return

        const unique = [...new Set(albums.flatMap((a) => a.artistNames))].sort((a, b) =>
          a.localeCompare(b),
        )
        setArtists(unique)

        if (unique.length > 0) {
          const images = await getArtistImageUrls(unique)
          if (!isActive) return
          setArtistImages(images)
        }
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

  const filteredArtists = useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed) return artists
    const lower = trimmed.toLowerCase()
    return artists.filter((a) => a.toLowerCase().includes(lower))
  }, [artists, query])

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto w-full max-w-7xl">
        <LinearBackButton />

        <h1 className="mt-5 text-3xl font-black text-ink">Your Artists</h1>

        {isLoading && (
          <div className="mt-12 flex justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-surface-2 border-t-cta" />
          </div>
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
          <>
            <div className="mt-5">
              <input
                type="search"
                placeholder="Search artists..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-lg border border-edge bg-surface px-4 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-cta"
              />
            </div>

            {filteredArtists.length === 0 ? (
              <p className="mt-6 text-sm text-ink-2">No artists match your search.</p>
            ) : (
              <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {filteredArtists.map((artist) => (
                  <button
                    key={artist}
                    type="button"
                    onClick={() => navigate(`/artists/${encodeURIComponent(artist)}`)}
                    className="text-left"
                  >
                    <div className="aspect-square w-full overflow-hidden rounded-lg bg-surface-2">
                      <AlbumCover
                        src={artistImages.get(artist) ?? null}
                        alt={`${artist} profile`}
                        loading="lazy"
                      />
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold text-ink">{artist}</p>
                  </button>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default ArtistsPage
