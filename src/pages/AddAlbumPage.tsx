import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import AlbumCover from '../components/AlbumCover'
import { saveAlbumForCurrentUser } from '../lib/db/reviewsData'
import {
  type AlbumSearchResult,
  fetchAlbumTracksWithLyrics,
  searchAlbums,
} from '../lib/external/musicMetadata'

function AddAlbumPage() {
  const navigate = useNavigate()
  const RESULTS_STEP = 8

  const [artistNameQuery, setArtistNameQuery] = useState('')
  const [albumTitleQuery, setAlbumTitleQuery] = useState('')
  const [results, setResults] = useState<AlbumSearchResult[]>([])
  const [visibleResultsCount, setVisibleResultsCount] = useState(RESULTS_STEP)
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [loadedCovers, setLoadedCovers] = useState<Set<string>>(new Set())

  const selectedAlbum = useMemo(
    () => results.find((album) => album.sourceAlbumId === selectedAlbumId) ?? null,
    [results, selectedAlbumId],
  )

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault()
    setIsSearching(true)
    setErrorMessage(null)
    setInfoMessage(null)
    setSelectedAlbumId(null)
    setVisibleResultsCount(RESULTS_STEP)
    setLoadedCovers(new Set())

    if (!artistNameQuery.trim() && !albumTitleQuery.trim()) {
      setErrorMessage('Enter an artist name, album title, or both.')
      setIsSearching(false)
      return
    }

    try {
      const albums = await searchAlbums({
        artistName: artistNameQuery,
        albumTitle: albumTitleQuery,
      })
      setResults(albums)

      if (albums.length === 0) {
        setInfoMessage('No album results found for that search.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Album search failed.'
      setErrorMessage(message)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSave = async () => {
    if (!selectedAlbum) {
      return
    }

    setIsSaving(true)
    setErrorMessage(null)

    try {
      const tracks = await fetchAlbumTracksWithLyrics(
        selectedAlbum.sourceAlbumId,
        selectedAlbum.artistName,
        selectedAlbum.artistNames,
      )

      if (tracks.length === 0) {
        throw new Error('No tracks were found for this album.')
      }

      const userSavedAlbumId = await saveAlbumForCurrentUser({
        sourceProvider: selectedAlbum.sourceProvider,
        sourceAlbumId: selectedAlbum.sourceAlbumId,
        title: selectedAlbum.title,
        artistName: selectedAlbum.artistName,
        coverUrl: selectedAlbum.coverUrl,
        releaseDate: selectedAlbum.releaseDate,
        metadata: { artists: selectedAlbum.artistNames },
        tracks,
      })

      navigate(`/reviews/${userSavedAlbumId}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Save failed.'
      setErrorMessage(message)
      setInfoMessage(null)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="page-wrap">
      {isSaving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(8,6,18,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="vco-panel flex flex-col items-center gap-4 px-10 py-8 text-center" style={{ maxWidth: 360 }}>
            <div
              className="h-10 w-10 rounded-full animate-spin"
              style={{ border: '3px solid #2a2548', borderTopColor: '#c4b5fd' }}
            />
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#ede9fe', lineHeight: 1.6 }}>
              Adding <span style={{ color: '#c4b5fd' }}>{selectedAlbum?.title}</span> by <span style={{ color: '#c4b5fd' }}>{selectedAlbum?.artistName}</span> to your library. This may take a while.
            </p>
          </div>
        </div>
      )}

      <h1 className="page-title">Add Album</h1>

      <section className="vco-panel" style={{ marginTop: 20, padding: '20px 24px' }}>
        <form onSubmit={handleSearch} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={artistNameQuery}
              onChange={(event) => setArtistNameQuery(event.target.value)}
              placeholder="Artist Name"
              style={{
                background: '#100d22',
                border: '1px solid #2a2548',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 13,
                color: '#ede9fe',
                fontFamily: "'JetBrains Mono', monospace",
                width: '100%',
              }}
            />
            <input
              type="text"
              value={albumTitleQuery}
              onChange={(event) => setAlbumTitleQuery(event.target.value)}
              placeholder="Album or Song Title"
              style={{
                background: '#100d22',
                border: '1px solid #2a2548',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 13,
                color: '#ede9fe',
                fontFamily: "'JetBrains Mono', monospace",
                width: '100%',
              }}
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={isSearching || isSaving}
              className="vco-tbtn primary"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {errorMessage && (
          <div className="vco-msg-err" style={{ marginTop: 16 }}>
            {errorMessage}
          </div>
        )}

        {infoMessage && (
          <p className="vco-empty" style={{ marginTop: 16 }}>
            {infoMessage}
          </p>
        )}

        {results.length > 0 && (
          <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              disabled={!selectedAlbum || isSaving || isSearching}
              onClick={() => void handleSave()}
              className="vco-tbtn primary"
            >
              {isSaving ? 'Saving...' : 'Save Selected'}
            </button>
          </div>
        )}

        {results.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <p className="vco-label" style={{ marginBottom: 12 }}>
              Showing {Math.min(visibleResultsCount, results.length)} of {results.length} results
            </p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {results.slice(0, visibleResultsCount).map((album) => {
                const isSelected = album.sourceAlbumId === selectedAlbumId

                return (
                  <button
                    key={album.sourceAlbumId}
                    type="button"
                    onClick={() => setSelectedAlbumId(album.sourceAlbumId)}
                    style={{
                      borderRadius: 8,
                      border: `1px solid ${isSelected ? '#7c3aed' : '#2a2548'}`,
                      background: isSelected ? '#1a1535' : '#141028',
                      padding: 12,
                      textAlign: 'left',
                      transition: 'opacity 0.3s, border-color 0.15s',
                      opacity: loadedCovers.has(album.sourceAlbumId) || !album.coverUrl ? 1 : 0,
                    }}
                  >
                    <div style={{ aspectRatio: '1', width: '100%', overflow: 'hidden', borderRadius: 6, background: '#0e0c1c' }}>
                      <AlbumCover
                        src={album.coverUrl}
                        alt={`${album.title} cover`}
                        loading="lazy"
                        onLoad={() => setLoadedCovers((prev) => { const next = new Set(prev); next.add(album.sourceAlbumId); return next })}
                      />
                    </div>

                    <p style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: '#ede9fe', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {album.title}
                    </p>
                    <p style={{ fontSize: 11, color: '#7c6fad', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {album.artistName}
                    </p>
                    <p style={{ marginTop: 4, fontSize: 11, color: '#4a4570' }}>
                      {album.totalTracks > 0 ? `${album.totalTracks} tracks` : 'Track count unknown'}
                    </p>
                  </button>
                )
              })}
            </div>

            {visibleResultsCount < results.length && (
              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setVisibleResultsCount((previous) => previous + RESULTS_STEP)}
                  className="vco-tbtn"
                >
                  Show More Results
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  )
}

export default AddAlbumPage
