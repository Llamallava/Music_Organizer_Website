import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import AlbumCover from '../components/AlbumCover'
import LinearBackButton from '../components/LinearBackButton'
import { getFriendsOverviewForCurrentUser, type FriendProfile } from '../lib/db/friendsData'
import {
  addSongToPlaylistForCurrentUser,
  createPlaylistForCurrentUser,
  deletePlaylistForCurrentUser,
  listPlaylistsWithSongsForCurrentUser,
  listSharedPlaylistsWithSongsForCurrentUser,
  sharePlaylistWithFriendForCurrentUser,
  unsharePlaylistWithFriendForCurrentUser,
  type PlaylistWithShares,
  type SharedPlaylistWithSongs,
} from '../lib/db/playlistsData'
import { searchSongs, type SongSearchResult } from '../lib/external/musicMetadata'

const getFriendDisplayName = (username: string | null | undefined, friendCode: string | null | undefined) => {
  const normalizedUsername = username?.trim()
  if (normalizedUsername) {
    return normalizedUsername
  }

  return friendCode ?? 'Unknown User'
}

function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<PlaylistWithShares[]>([])
  const [sharedPlaylists, setSharedPlaylists] = useState<SharedPlaylistWithSongs[]>([])
  const [friends, setFriends] = useState<FriendProfile[]>([])
  const [expandedByPlaylistId, setExpandedByPlaylistId] = useState<Record<string, boolean>>({})
  const [expandedSharedByPlaylistId, setExpandedSharedByPlaylistId] = useState<Record<string, boolean>>({})
  const [shareTargetByPlaylistId, setShareTargetByPlaylistId] = useState<Record<string, string>>({})
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [selectedAddPlaylistId, setSelectedAddPlaylistId] = useState('')
  const [musicBrainzArtistQuery, setMusicBrainzArtistQuery] = useState('')
  const [musicBrainzSongQuery, setMusicBrainzSongQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SongSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isSearchingSongs, setIsSearchingSongs] = useState(false)
  const [deletingPlaylistId, setDeletingPlaylistId] = useState<string | null>(null)
  const [addingSongKey, setAddingSongKey] = useState<string | null>(null)
  const [sharingPlaylistId, setSharingPlaylistId] = useState<string | null>(null)
  const [unsharingShareKey, setUnsharingShareKey] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const loadPlaylistWorkspace = async () => {
    const [ownedPlaylists, receivedSharedPlaylists, friendsOverview] = await Promise.all([
      listPlaylistsWithSongsForCurrentUser(),
      listSharedPlaylistsWithSongsForCurrentUser(),
      getFriendsOverviewForCurrentUser(),
    ])

    return {
      ownedPlaylists,
      receivedSharedPlaylists,
      friends: friendsOverview.friends,
    }
  }

  const applyPlaylistWorkspace = (
    ownedPlaylists: PlaylistWithShares[],
    receivedSharedPlaylists: SharedPlaylistWithSongs[],
    friendRecords: FriendProfile[],
  ) => {
    setPlaylists(ownedPlaylists)
    setSharedPlaylists(receivedSharedPlaylists)
    setFriends(friendRecords)

    setSelectedAddPlaylistId((previous) => {
      if (previous && ownedPlaylists.some((playlist) => playlist.id === previous)) {
        return previous
      }

      return ownedPlaylists[0]?.id || ''
    })

    setShareTargetByPlaylistId((previous) => {
      const friendUserIds = new Set(friendRecords.map((friend) => friend.userId))
      const next: Record<string, string> = {}

      for (const playlist of ownedPlaylists) {
        const sharedFriendUserIds = new Set(playlist.sharedWith.map((recipient) => recipient.friendUserId))
        const previousTarget = previous[playlist.id]

        if (previousTarget && friendUserIds.has(previousTarget) && !sharedFriendUserIds.has(previousTarget)) {
          next[playlist.id] = previousTarget
          continue
        }

        const firstAvailableFriend = friendRecords.find((friend) => !sharedFriendUserIds.has(friend.userId))
        next[playlist.id] = firstAvailableFriend?.userId ?? ''
      }

      return next
    })
  }

  const refreshPlaylistWorkspace = async () => {
    const workspace = await loadPlaylistWorkspace()
    applyPlaylistWorkspace(workspace.ownedPlaylists, workspace.receivedSharedPlaylists, workspace.friends)
  }

  useEffect(() => {
    let isActive = true

    const loadInitialData = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const workspace = await loadPlaylistWorkspace()
        if (!isActive) {
          return
        }

        applyPlaylistWorkspace(workspace.ownedPlaylists, workspace.receivedSharedPlaylists, workspace.friends)
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

    void loadInitialData()

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

  const toggleSharedPlaylistExpansion = (playlistId: string) => {
    setExpandedSharedByPlaylistId((previous) => ({
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
      await refreshPlaylistWorkspace()
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
      await refreshPlaylistWorkspace()

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

  const handleSearchSongs = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setInfoMessage(null)
    setIsSearchingSongs(true)

    if (!musicBrainzArtistQuery.trim() && !musicBrainzSongQuery.trim()) {
      setErrorMessage('Enter a song title, artist name, or both.')
      setIsSearchingSongs(false)
      return
    }

    try {
      const results = await searchSongs({
        artistName: musicBrainzArtistQuery,
        songTitle: musicBrainzSongQuery,
      })

      setSearchResults(results)
      if (results.length === 0) {
        setInfoMessage('No MusicBrainz song results found for that search.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to search songs.'
      setErrorMessage(message)
    } finally {
      setIsSearchingSongs(false)
    }
  }

  const handleAddSongToPlaylist = async (song: SongSearchResult) => {
    const songKey = song.sourceSongId

    setErrorMessage(null)
    setInfoMessage(null)
    setAddingSongKey(songKey)

    try {
      await addSongToPlaylistForCurrentUser({
        playlistId: selectedAddPlaylistId,
        sourceProvider: song.sourceProvider,
        sourceSongId: song.sourceSongId,
        songName: song.songName,
        artistName: song.artistName,
        albumTitle: song.albumTitle,
        coverUrl: song.coverUrl,
      })

      await refreshPlaylistWorkspace()
      setInfoMessage(`Added "${song.songName}" to playlist.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add song to playlist.'
      setErrorMessage(message)
    } finally {
      setAddingSongKey(null)
    }
  }

  const handleSharePlaylist = async (playlistId: string) => {
    const friendUserId = shareTargetByPlaylistId[playlistId]?.trim()
    if (!friendUserId) {
      setErrorMessage('Choose a friend to share this playlist with.')
      return
    }

    setErrorMessage(null)
    setInfoMessage(null)
    setSharingPlaylistId(playlistId)

    try {
      await sharePlaylistWithFriendForCurrentUser({
        playlistId,
        friendUserId,
      })

      await refreshPlaylistWorkspace()
      setInfoMessage('Playlist shared.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to share playlist.'
      setErrorMessage(message)
    } finally {
      setSharingPlaylistId(null)
    }
  }

  const handleUnsharePlaylist = async (playlistId: string, friendUserId: string) => {
    const shareKey = `${playlistId}:${friendUserId}`

    setErrorMessage(null)
    setInfoMessage(null)
    setUnsharingShareKey(shareKey)

    try {
      await unsharePlaylistWithFriendForCurrentUser({
        playlistId,
        friendUserId,
      })

      await refreshPlaylistWorkspace()
      setInfoMessage('Playlist share removed.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove playlist share.'
      setErrorMessage(message)
    } finally {
      setUnsharingShareKey(null)
    }
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <LinearBackButton />

        <h1 className="mt-5 text-3xl font-black text-slate-900">Playlists</h1>
        <p className="mt-2 text-sm text-slate-700">
          Create playlists, share them with friends, and add songs from MusicBrainz.
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

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Add Songs From MusicBrainz</h2>
          <p className="mt-1 text-sm text-slate-700">
            Search individual songs and add them directly to one of your playlists.
          </p>

          <form onSubmit={handleSearchSongs} className="mt-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-800">
                Song title
                <input
                  type="text"
                  value={musicBrainzSongQuery}
                  onChange={(event) => setMusicBrainzSongQuery(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="text-sm font-semibold text-slate-800">
                Artist name
                <input
                  type="text"
                  value={musicBrainzArtistQuery}
                  onChange={(event) => setMusicBrainzArtistQuery(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <label className="text-sm font-semibold text-slate-800">
                Target Playlist
                <select
                  value={selectedAddPlaylistId}
                  onChange={(event) => setSelectedAddPlaylistId(event.target.value)}
                  disabled={playlists.length === 0}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {playlists.length === 0 && <option value="">No playlists available</option>}
                  {playlists.map((playlist) => (
                    <option key={playlist.id} value={playlist.id}>
                      {playlist.name}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                disabled={isSearchingSongs}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isSearchingSongs ? 'Searching...' : 'Search Songs'}
              </button>
            </div>
          </form>

          {playlists.length === 0 && (
            <p className="mt-3 text-sm text-slate-700">Create a playlist before adding songs.</p>
          )}

          {!isSearchingSongs && searchResults.length > 0 && (
            <>
              <p className="mt-4 text-sm text-slate-700">
                Results: <span className="font-semibold text-slate-900">{searchResults.length}</span>
              </p>
              <div className="mt-3 max-h-[420px] space-y-2 overflow-auto pr-1">
                {searchResults.map((song) => (
                  <article
                    key={song.sourceSongId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-slate-200">
                        <AlbumCover src={song.coverUrl} alt={`${song.songName} cover`} loading="lazy" />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{song.songName}</p>
                        <p className="truncate text-xs text-slate-700">{song.artistName}</p>
                        <p className="truncate text-xs text-slate-500">{song.albumTitle ?? 'Single / Unknown Album'}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleAddSongToPlaylist(song)}
                      disabled={addingSongKey !== null || playlists.length === 0 || !selectedAddPlaylistId}
                      className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {addingSongKey === song.sourceSongId ? 'Adding...' : 'Add to Playlist'}
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

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
              const sharedFriendIds = new Set(playlist.sharedWith.map((recipient) => recipient.friendUserId))
              const availableFriends = friends.filter((friend) => !sharedFriendIds.has(friend.userId))
              const shareTarget = shareTargetByPlaylistId[playlist.id] ?? ''

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
                        {playlist.songs.length} {playlist.songs.length === 1 ? 'song' : 'songs'} - Shared with{' '}
                        {playlist.sharedWith.length} {playlist.sharedWith.length === 1 ? 'friend' : 'friends'} -{' '}
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
                    <div className="mt-4 space-y-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-sm font-semibold text-slate-900">Share Playlist</p>
                        <p className="mt-1 text-xs text-slate-700">Friends you share with can view this playlist.</p>

                        <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                          <label className="text-sm font-semibold text-slate-800">
                            Friend
                            <select
                              value={shareTarget}
                              onChange={(event) =>
                                setShareTargetByPlaylistId((previous) => ({
                                  ...previous,
                                  [playlist.id]: event.target.value,
                                }))
                              }
                              disabled={availableFriends.length === 0 || sharingPlaylistId !== null}
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                            >
                              {availableFriends.length === 0 && <option value="">No friends available</option>}
                              {availableFriends.map((friend) => (
                                <option key={friend.userId} value={friend.userId}>
                                  {getFriendDisplayName(friend.username, friend.friendCode)}
                                </option>
                              ))}
                            </select>
                          </label>

                          <button
                            type="button"
                            onClick={() => void handleSharePlaylist(playlist.id)}
                            disabled={!shareTarget || sharingPlaylistId !== null}
                            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            {sharingPlaylistId === playlist.id ? 'Sharing...' : 'Share'}
                          </button>
                        </div>

                        {friends.length === 0 && (
                          <p className="mt-2 text-xs text-slate-700">Add a friend first to share playlists.</p>
                        )}

                        {playlist.sharedWith.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {playlist.sharedWith.map((recipient) => {
                              const shareKey = `${playlist.id}:${recipient.friendUserId}`

                              return (
                                <div
                                  key={shareKey}
                                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                                >
                                  <p className="min-w-0 truncate text-sm text-slate-800">
                                    {getFriendDisplayName(recipient.friendUsername, recipient.friendCode)}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => void handleUnsharePlaylist(playlist.id, recipient.friendUserId)}
                                    disabled={unsharingShareKey !== null}
                                    className="shrink-0 rounded-lg border border-rose-300 bg-white px-3 py-1 text-xs font-semibold text-rose-700 disabled:opacity-60"
                                  >
                                    {unsharingShareKey === shareKey ? 'Removing...' : 'Remove'}
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

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
                            <AlbumCover
                              src={song.coverUrl}
                              alt={`${song.albumTitle ?? song.trackTitle} cover`}
                              loading="lazy"
                            />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{song.trackTitle}</p>
                            <p className="truncate text-xs text-slate-700">
                              {song.artistName} - {song.albumTitle ?? 'Single / Unknown Album'}
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

        {!isLoading && (
          <section className="mt-8">
            <h2 className="text-xl font-black text-slate-900">Shared With Me</h2>
            <p className="mt-1 text-sm text-slate-700">Read-only playlists friends have shared with you.</p>

            {sharedPlaylists.length === 0 && (
              <p className="mt-4 rounded-lg bg-white p-4 text-sm text-slate-700">No playlists shared with you yet.</p>
            )}

            {sharedPlaylists.length > 0 && (
              <div className="mt-4 space-y-3">
                {sharedPlaylists.map((playlist) => {
                  const isExpanded = Boolean(expandedSharedByPlaylistId[playlist.id])
                  const ownerName = getFriendDisplayName(playlist.ownerUsername, playlist.ownerFriendCode)

                  return (
                    <article
                      key={playlist.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSharedPlaylistExpansion(playlist.id)}
                        className="w-full min-w-0 text-left"
                      >
                        <p className="truncate text-base font-semibold text-slate-900">{playlist.name}</p>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Shared by {ownerName} - {playlist.songs.length} {playlist.songs.length === 1 ? 'song' : 'songs'} -{' '}
                          {isExpanded ? 'Expanded' : 'Collapsed'}
                        </p>
                      </button>

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
                                <AlbumCover
                                  src={song.coverUrl}
                                  alt={`${song.albumTitle ?? song.trackTitle} cover`}
                                  loading="lazy"
                                />
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">{song.trackTitle}</p>
                                <p className="truncate text-xs text-slate-700">
                                  {song.artistName} - {song.albumTitle ?? 'Single / Unknown Album'}
                                </p>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}

export default PlaylistsPage
