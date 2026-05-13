import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AlbumCover from '../components/AlbumCover'
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
    <main className="page-wrap">
      <h1 className="page-title">Your Artists</h1>

      {isLoading && (
        <div style={{ marginTop: 48, display: 'flex', justifyContent: 'center' }}>
          <div
            className="animate-spin"
            style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #2a2548', borderTopColor: '#c4b5fd' }}
          />
        </div>
      )}

      {!isLoading && errorMessage && (
        <div className="vco-msg-err" style={{ marginTop: 20 }}>
          Could not load artists. {errorMessage}
        </div>
      )}

      {!isLoading && !errorMessage && artists.length === 0 && (
        <p className="vco-empty">No artists found. Save some albums first.</p>
      )}

      {!isLoading && !errorMessage && artists.length > 0 && (
        <>
          <div style={{ marginTop: 20 }}>
            <input
              type="search"
              placeholder="Search artists..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: '100%',
                maxWidth: 400,
                borderRadius: 6,
                border: '1px solid #2a2548',
                padding: '8px 12px',
                fontSize: 13,
              }}
            />
          </div>

          {filteredArtists.length === 0 ? (
            <p className="vco-empty">No artists match your search.</p>
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
    </main>
  )
}

export default ArtistsPage
