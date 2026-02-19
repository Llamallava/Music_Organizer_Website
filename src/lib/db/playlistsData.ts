import { supabase } from '../supabaseClient'

export type Playlist = {
  id: string
  name: string
  createdAt: string
}

export type PlaylistOption = {
  id: string
  name: string
}

export type PlaylistSong = {
  id: string
  userSavedAlbumId: string
  trackNumber: number
  trackTitle: string
  albumTitle: string
  artistName: string
  coverUrl: string | null
  createdAt: string
}

export type PlaylistWithSongs = Playlist & {
  songs: PlaylistSong[]
}

const throwIfError = (error: { message: string } | null, context: string) => {
  if (error) {
    throw new Error(`${context}: ${error.message}`)
  }
}

const requireAuthenticatedUserId = async () => {
  const { data, error } = await supabase.auth.getUser()
  throwIfError(error, 'Failed to resolve current user')

  const userId = data.user?.id
  if (!userId) {
    throw new Error('No authenticated user. Sign in first.')
  }

  return userId
}

const normalizePlaylistName = (name: string) => name.trim()

export const listPlaylistOptionsForCurrentUser = async (): Promise<PlaylistOption[]> => {
  const userId = await requireAuthenticatedUserId()

  const { data, error } = await supabase
    .from('playlists')
    .select('id, name')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  throwIfError(error, 'Failed to list playlists')

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
  }))
}

export const listPlaylistsWithSongsForCurrentUser = async (): Promise<PlaylistWithSongs[]> => {
  const userId = await requireAuthenticatedUserId()

  const { data: playlistRows, error: playlistsError } = await supabase
    .from('playlists')
    .select('id, name, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  throwIfError(playlistsError, 'Failed to list playlists')

  const playlists = (playlistRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    songs: [] as PlaylistSong[],
  }))

  if (playlists.length === 0) {
    return []
  }

  const playlistIds = playlists.map((playlist) => playlist.id)
  const { data: playlistSongRows, error: playlistSongsError } = await supabase
    .from('playlist_songs')
    .select('id, playlist_id, user_saved_album_id, track_number, created_at')
    .in('playlist_id', playlistIds)
    .order('created_at', { ascending: false })

  throwIfError(playlistSongsError, 'Failed to list playlist songs')

  const songRows = playlistSongRows ?? []
  if (songRows.length === 0) {
    return playlists
  }

  const userSavedAlbumIds = Array.from(new Set(songRows.map((row) => row.user_saved_album_id)))
  const { data: savedAlbumRows, error: savedAlbumsError } = await supabase
    .from('user_saved_albums')
    .select('id, album_id')
    .in('id', userSavedAlbumIds)
    .eq('user_id', userId)

  throwIfError(savedAlbumsError, 'Failed to load saved albums for playlists')

  const savedAlbumById = new Map((savedAlbumRows ?? []).map((row) => [row.id, row]))
  const albumIds = Array.from(new Set((savedAlbumRows ?? []).map((row) => row.album_id)))

  const albumById = new Map<string, { title: string; artistName: string; coverUrl: string | null }>()
  if (albumIds.length > 0) {
    const { data: albumRows, error: albumsError } = await supabase
      .from('albums')
      .select('id, title, artist_name, cover_url')
      .in('id', albumIds)

    throwIfError(albumsError, 'Failed to load album metadata for playlists')

    for (const row of albumRows ?? []) {
      albumById.set(row.id, {
        title: row.title,
        artistName: row.artist_name,
        coverUrl: row.cover_url,
      })
    }
  }

  const trackTitleByAlbumAndNumber = new Map<string, string>()
  if (albumIds.length > 0) {
    const { data: trackRows, error: tracksError } = await supabase
      .from('album_tracks')
      .select('album_id, track_number, title')
      .in('album_id', albumIds)

    throwIfError(tracksError, 'Failed to load track metadata for playlists')

    for (const row of trackRows ?? []) {
      trackTitleByAlbumAndNumber.set(`${row.album_id}:${row.track_number}`, row.title)
    }
  }

  const songsByPlaylistId = new Map<string, PlaylistSong[]>()

  for (const row of songRows) {
    const savedAlbum = savedAlbumById.get(row.user_saved_album_id)
    if (!savedAlbum) {
      continue
    }

    const album = albumById.get(savedAlbum.album_id)
    if (!album) {
      continue
    }

    const trackTitle =
      trackTitleByAlbumAndNumber.get(`${savedAlbum.album_id}:${row.track_number}`) ??
      `Track ${row.track_number}`

    const existing = songsByPlaylistId.get(row.playlist_id) ?? []
    existing.push({
      id: row.id,
      userSavedAlbumId: row.user_saved_album_id,
      trackNumber: row.track_number,
      trackTitle,
      albumTitle: album.title,
      artistName: album.artistName,
      coverUrl: album.coverUrl,
      createdAt: row.created_at,
    })
    songsByPlaylistId.set(row.playlist_id, existing)
  }

  return playlists.map((playlist) => ({
    ...playlist,
    songs: songsByPlaylistId.get(playlist.id) ?? [],
  }))
}

export const createPlaylistForCurrentUser = async (name: string): Promise<Playlist> => {
  const userId = await requireAuthenticatedUserId()
  const normalizedName = normalizePlaylistName(name)

  if (!normalizedName) {
    throw new Error('Playlist name is required.')
  }

  const { data, error } = await supabase
    .from('playlists')
    .insert({
      user_id: userId,
      name: normalizedName,
    })
    .select('id, name, created_at')
    .single()

  if (error?.code === '23505') {
    throw new Error('You already have a playlist with this name.')
  }

  throwIfError(error, 'Failed to create playlist')

  if (!data) {
    throw new Error('Playlist creation succeeded but no row was returned.')
  }

  return {
    id: data.id,
    name: data.name,
    createdAt: data.created_at,
  }
}

export const deletePlaylistForCurrentUser = async (playlistId: string): Promise<void> => {
  const userId = await requireAuthenticatedUserId()

  if (!playlistId.trim()) {
    throw new Error('Missing playlist identifier.')
  }

  const { error } = await supabase
    .from('playlists')
    .delete()
    .eq('id', playlistId)
    .eq('user_id', userId)

  throwIfError(error, 'Failed to delete playlist')
}

export const addSongToPlaylistForCurrentUser = async (params: {
  playlistId: string
  userSavedAlbumId: string
  trackNumber: number
}): Promise<void> => {
  const userId = await requireAuthenticatedUserId()
  const playlistId = params.playlistId.trim()
  const userSavedAlbumId = params.userSavedAlbumId.trim()

  if (!playlistId) {
    throw new Error('Please choose a playlist first.')
  }

  if (!userSavedAlbumId) {
    throw new Error('Missing saved album identifier.')
  }

  if (!Number.isInteger(params.trackNumber) || params.trackNumber <= 0) {
    throw new Error('Track number must be a positive integer.')
  }

  const { data: playlistRow, error: playlistError } = await supabase
    .from('playlists')
    .select('id')
    .eq('id', playlistId)
    .eq('user_id', userId)
    .maybeSingle()

  throwIfError(playlistError, 'Failed to validate playlist')

  if (!playlistRow) {
    throw new Error('Playlist not found.')
  }

  const { data: savedAlbumRow, error: savedAlbumError } = await supabase
    .from('user_saved_albums')
    .select('album_id')
    .eq('id', userSavedAlbumId)
    .eq('user_id', userId)
    .maybeSingle()

  throwIfError(savedAlbumError, 'Failed to validate saved album')

  if (!savedAlbumRow) {
    throw new Error('Saved album not found.')
  }

  const { data: trackRow, error: trackError } = await supabase
    .from('album_tracks')
    .select('id')
    .eq('album_id', savedAlbumRow.album_id)
    .eq('track_number', params.trackNumber)
    .maybeSingle()

  throwIfError(trackError, 'Failed to validate track')

  if (!trackRow) {
    throw new Error('Track not found for this album.')
  }

  const { error } = await supabase.from('playlist_songs').insert({
    playlist_id: playlistId,
    user_saved_album_id: userSavedAlbumId,
    track_number: params.trackNumber,
  })

  if (error?.code === '23505') {
    throw new Error('That song is already in this playlist.')
  }

  throwIfError(error, 'Failed to add song to playlist')
}
