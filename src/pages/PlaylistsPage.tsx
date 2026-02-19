import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import AlbumCover from '../components/AlbumCover'
import LinearBackButton from '../components/LinearBackButton'
import {
  createPlaylistForCurrentUser,
  deletePlaylistForCurrentUser,
  listPlaylistsWithSongsForCurrentUser,
  type PlaylistWithSongs,
} from '../lib/db/playlistsData'

function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<PlaylistWithSongs[]>([])
  const [expandedByPlaylistId, setExpandedByPlaylistId] = useState<Record<string, boolean>>({})
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [deletingPlaylistId, setDeletingPlaylistId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    const loadPlaylists = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const records = await listPlaylistsWithSongsForCurrentUser()
        if (!isActive) {
          return
        }

        setPlaylists(records)
      } catch (error) {
        if (!isActive) {
          return
        }

        const message = error instanceof Error ? error.message : 'Failed to load playlists.'
        setErrorMessage(message)
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadPlaylists()

    return () => {
      isActive = false
    }
  }, [])

  const togglePlaylistExpansion = (playlistId: string) => {
    setExpandedByPlaylistId((previous) => ({
      ...previous,
      [playlistId]: !previous[playlistId],
    }))
  }

  const handleCreatePlaylist = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setInfoMessage(null)
    setIsCreating(true)

    try {
      const createdPlaylist = await createPlaylistForCurrentUser(newPlaylistName)

      setPlaylists((previous) => [{ ...createdPlaylist, songs: [] }, ...previous])
      setExpandedByPlaylistId((previous) => ({
        ...previous,
        [createdPlaylist.id]: true,
      }))
      setNewPlaylistName('')
      setInfoMessage('Playlist created.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create playlist.'
      setErrorMessage(message)
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeletePlaylist = async (playlistId: string) => {
    setErrorMessage(null)
    setInfoMessage(null)
    setDeletingPlaylistId(playlistId)

    try {
      await deletePlaylistForCurrentUser(playlistId)
      setPlaylists((previous) => previous.filter((playlist) => playlist.id !== playlistId))
      setExpandedByPlaylistId((previous) => {
        const next = { ...previous }
        delete next[playlistId]
        return next
      })
      setInfoMessage('Playlist deleted.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete playlist.'
      setErrorMessage(message)
    } finally {
      setDeletingPlaylistId(null)
    }
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <LinearBackButton />

        <h1 className="mt-5 text-3xl font-black text-slate-900">Playlists</h1>
        <p className="mt-2 text-sm text-slate-700">
          Create playlists, remove playlists, and expand any playlist to view its songs.
        </p>

        <form
          onSubmit={handleCreatePlaylist}
          className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <label className="text-sm font-semibold text-slate-800">
            New Playlist Name
            <input
              type="text"
              value={newPlaylistName}
              onChange={(event) => setNewPlaylistName(event.target.value)}
              required
              maxLength={120}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <button
            type="submit"
            disabled={isCreating}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isCreating ? 'Creating...' : 'Create Playlist'}
          </button>
        </form>

        {errorMessage && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        )}

        {infoMessage && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {infoMessage}
          </div>
        )}

        {isLoading && <p className="mt-6 rounded-lg bg-white p-4 text-sm text-slate-700">Loading playlists...</p>}

        {!isLoading && playlists.length === 0 && (
          <p className="mt-6 rounded-lg bg-white p-4 text-sm text-slate-700">
            No playlists yet. Create your first playlist above.
          </p>
        )}

        {!isLoading && playlists.length > 0 && (
          <section className="mt-6 space-y-3">
            {playlists.map((playlist) => {
              const isExpanded = Boolean(expandedByPlaylistId[playlist.id])

              return (
                <article
                  key={playlist.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => togglePlaylistExpansion(playlist.id)}
                      className="min-w-0 text-left"
                    >
                      <p className="truncate text-base font-semibold text-slate-900">{playlist.name}</p>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {playlist.songs.length} {playlist.songs.length === 1 ? 'song' : 'songs'} -{' '}
                        {isExpanded ? 'Expanded' : 'Collapsed'}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDeletePlaylist(playlist.id)}
                      disabled={deletingPlaylistId !== null}
                      className="shrink-0 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-60"
                    >
                      {deletingPlaylistId === playlist.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-2">
                      {playlist.songs.length === 0 && (
                        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          This playlist is empty.
                        </p>
                      )}

                      {playlist.songs.map((song) => (
                        <article
                          key={song.id}
                          className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                        >
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-slate-200">
                            <AlbumCover src={song.coverUrl} alt={`${song.albumTitle} cover`} loading="lazy" />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {song.trackNumber}. {song.trackTitle}
                            </p>
                            <p className="truncate text-xs text-slate-700">
                              {song.artistName} • {song.albumTitle}
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </article>
              )
            })}
          </section>
        )}
      </div>
    </main>
  )
}

export default PlaylistsPage
