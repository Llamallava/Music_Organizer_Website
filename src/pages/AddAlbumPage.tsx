import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import AlbumCover from '../components/AlbumCover'
import LinearBackButton from '../components/LinearBackButton'
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
    <main className="min-h-screen px-6 py-8">
      {isSaving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30">
          <div className="flex flex-col items-center gap-4 rounded-xl border border-edge bg-surface px-10 py-8 shadow-xl text-center max-w-sm mx-4">
            <div className="h-10 w-10 rounded-full border-4 border-edge border-t-mint animate-spin" />
            <p className="text-sm font-medium text-ink">
              We are adding <span className="font-semibold">{selectedAlbum?.title}</span> by <span className="font-semibold">{selectedAlbum?.artistName}</span> to your library. This may take a while, please be patient.
            </p>
          </div>
        </div>
      )}
      <div className="mx-auto w-full max-w-7xl">
        <LinearBackButton />

        <section className="mt-6 rounded-xl border border-edge bg-surface p-6">
          <h1 className="text-2xl font-bold text-ink">Add Album</h1>

          <form onSubmit={handleSearch} className="mt-4 flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                value={artistNameQuery}
                onChange={(event) => setArtistNameQuery(event.target.value)}
                placeholder="Artist Name"
                className="w-full rounded-lg border border-edge px-3 py-2 text-sm text-ink"
              />
              <input
                type="text"
                value={albumTitleQuery}
                onChange={(event) => setAlbumTitleQuery(event.target.value)}
                placeholder="Album or Song Title"
                className="w-full rounded-lg border border-edge px-3 py-2 text-sm text-ink"
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={isSearching || isSaving}
                className="rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>

          {errorMessage && (
            <div className="mt-4 rounded-lg border border-err-edge bg-err-bg p-3 text-sm text-err">
              {errorMessage}
            </div>
          )}

          {infoMessage && (
            <div className="mt-4 rounded-lg border border-info-edge bg-info-bg p-3 text-sm text-info">
              {infoMessage}
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!selectedAlbum || isSaving || isSearching}
                onClick={() => void handleSave()}
                className="rounded-lg bg-mint px-4 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-4">
              <div className="mb-3 text-xs text-ink-2">
                Showing {Math.min(visibleResultsCount, results.length)} of {results.length} results
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {results.slice(0, visibleResultsCount).map((album) => {
                  const isSelected = album.sourceAlbumId === selectedAlbumId

                  return (
                  <button
                    key={album.sourceAlbumId}
                    type="button"
                    onClick={() => setSelectedAlbumId(album.sourceAlbumId)}
                    className={`rounded-lg border p-3 text-left transition-opacity duration-300 ${
                      isSelected
                        ? 'border-cta bg-surface-2'
                        : 'border-edge bg-surface hover:border-ink-3'
                    } ${loadedCovers.has(album.sourceAlbumId) || !album.coverUrl ? 'opacity-100' : 'opacity-0'}`}
                  >
                    <div className="aspect-square w-full overflow-hidden rounded-md bg-surface-2">
                      <AlbumCover
                          src={album.coverUrl}
                          alt={`${album.title} cover`}
                          loading="lazy"
                          onLoad={() => setLoadedCovers((prev) => { const next = new Set(prev); next.add(album.sourceAlbumId); return next })}
                        />
                    </div>

                    <p className="mt-2 truncate text-sm font-semibold text-ink">{album.title}</p>
                    <p className="truncate text-xs text-ink-2">{album.artistName}</p>
                    <p className="mt-1 text-xs text-ink-3">
                      {album.totalTracks > 0 ? `${album.totalTracks} tracks` : 'Track count unknown'}
                    </p>
                  </button>
                )
              })}
              </div>

              {visibleResultsCount < results.length && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setVisibleResultsCount((previous) => previous + RESULTS_STEP)}
                    className="rounded-lg bg-surface-2 px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-3"
                  >
                    Show More Results
                  </button>
                </div>
              )}
            </div>
          )}

        </section>
      </div>
    </main>
  )
}

export default AddAlbumPage
