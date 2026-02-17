import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveAlbumForCurrentUser } from '../lib/db/reviewsData'
import {
  type AlbumSearchResult,
  fetchAlbumTracksWithLyrics,
  searchAlbums,
} from '../lib/external/musicMetadata'

function AddAlbumPage() {
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AlbumSearchResult[]>([])
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

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

    try {
      const albums = await searchAlbums(query)
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
    setInfoMessage('Fetching tracks and lyrics, then saving...')

    try {
      const tracks = await fetchAlbumTracksWithLyrics(
        selectedAlbum.sourceAlbumId,
        selectedAlbum.artistName,
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
        metadata: {},
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
      <div className="mx-auto w-full max-w-7xl">
        <button
          type="button"
          onClick={() => navigate('/reviews')}
          className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-900"
        >
          Back to Reviews
        </button>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-bold text-slate-900">Add Album</h1>
          <p className="mt-2 text-sm text-slate-700">Search an album, choose one result, and save it.</p>

          <form onSubmit={handleSearch} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search album title or artist"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
            <button
              type="submit"
              disabled={isSearching || isSaving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {errorMessage && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}

          {infoMessage && (
            <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-700">
              {infoMessage}
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {results.map((album) => {
                const isSelected = album.sourceAlbumId === selectedAlbumId

                return (
                  <button
                    key={album.sourceAlbumId}
                    type="button"
                    onClick={() => setSelectedAlbumId(album.sourceAlbumId)}
                    className={`rounded-lg border p-3 text-left ${
                      isSelected
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="aspect-square w-full overflow-hidden rounded-md bg-slate-200">
                      {album.coverUrl ? (
                        <img
                          src={album.coverUrl}
                          alt={`${album.title} cover`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">
                          No Cover
                        </div>
                      )}
                    </div>

                    <p className="mt-2 truncate text-sm font-semibold text-slate-900">{album.title}</p>
                    <p className="truncate text-xs text-slate-600">{album.artistName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {album.totalTracks > 0 ? `${album.totalTracks} tracks` : 'Track count unknown'}
                    </p>
                  </button>
                )
              })}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!selectedAlbum || isSaving || isSearching}
              onClick={() => void handleSave()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

export default AddAlbumPage
