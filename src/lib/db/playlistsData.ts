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
  trackTitle: string
  artistName: string
  albumTitle: string | null
  coverUrl: string | null
  trackNumber: number | null
  sourceProvider: string | null
  sourceSongId: string | null
  createdAt: string
}

export type PlaylistWithSongs = Playlist & {
  songs: PlaylistSong[]
}

export type PlaylistShareRecipient = {
  friendUserId: string
  friendUsername: string | null
  friendCode: string | null
  sharedAt: string
}

export type PlaylistWithShares = PlaylistWithSongs & {
  sharedWith: PlaylistShareRecipient[]
}

export type SharedPlaylistWithSongs = PlaylistWithSongs & {
  ownerUserId: string
  ownerUsername: string | null
  ownerFriendCode: string | null
  sharedAt: string
}

type AddLocalSongToPlaylistParams = {
  playlistId: string
  userSavedAlbumId: string
  trackNumber: number
}

type AddExternalSongToPlaylistParams = {
  playlistId: string
  sourceProvider: 'musicbrainz'
  sourceSongId: string
  songName: string
  artistName: string
  albumTitle?: string | null
  coverUrl?: string | null
}

export type AddSongToPlaylistParams = AddLocalSongToPlaylistParams | AddExternalSongToPlaylistParams

type SharePlaylistParams = {
  playlistId: string
  friendUserId: string
}

type PlaylistRow = {
  id: string
  name: string
  created_at: string
}

const throwIfError = (error: { message: string; code?: string } | null, context: string) => {
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

const ensurePlaylistOwnedByUser = async (playlistId: string, userId: string) => {
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
}

const hydratePlaylistsWithSongs = async (playlistRows: PlaylistRow[]): Promise<PlaylistWithSongs[]> => {
  const playlists = playlistRows.map((row) => ({
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
    .select(
      'id, playlist_id, user_saved_album_id, track_number, source_provider, source_song_id, song_name, artist_name, album_title, cover_url, created_at',
    )
    .in('playlist_id', playlistIds)
    .order('created_at', { ascending: false })

  throwIfError(playlistSongsError, 'Failed to list playlist songs')

  const songRows = playlistSongRows ?? []
  if (songRows.length === 0) {
    return playlists
  }

  const userSavedAlbumIds = Array.from(
    new Set(
      songRows
        .map((row) => row.user_saved_album_id)
        .filter((value): value is string => Boolean(value)),
    ),
  )

  const savedAlbumById = new Map<string, { album_id: string }>()
  if (userSavedAlbumIds.length > 0) {
    const { data: savedAlbumRows, error: savedAlbumsError } = await supabase
      .from('user_saved_albums')
      .select('id, album_id')
      .in('id', userSavedAlbumIds)

    throwIfError(savedAlbumsError, 'Failed to load saved albums for playlists')

    for (const row of savedAlbumRows ?? []) {
      savedAlbumById.set(row.id, { album_id: row.album_id })
    }
  }

  const albumIds = Array.from(new Set(Array.from(savedAlbumById.values()).map((row) => row.album_id)))
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
    const existing = songsByPlaylistId.get(row.playlist_id) ?? []

    if (row.user_saved_album_id !== null && row.track_number !== null) {
      const savedAlbum = savedAlbumById.get(row.user_saved_album_id)
      const album = savedAlbum ? albumById.get(savedAlbum.album_id) : null

      const trackTitle =
        (savedAlbum ? trackTitleByAlbumAndNumber.get(`${savedAlbum.album_id}:${row.track_number}`) : null) ??
        row.song_name ??
        `Track ${row.track_number}`

      existing.push({
        id: row.id,
        trackTitle,
        artistName: album?.artistName ?? row.artist_name ?? 'Unknown Artist',
        albumTitle: album?.title ?? row.album_title ?? null,
        coverUrl: album?.coverUrl ?? row.cover_url,
        trackNumber: row.track_number,
        sourceProvider: row.source_provider,
        sourceSongId: row.source_song_id,
        createdAt: row.created_at,
      })
    } else {
      existing.push({
        id: row.id,
        trackTitle: row.song_name ?? 'Unknown Song',
        artistName: row.artist_name ?? 'Unknown Artist',
        albumTitle: row.album_title,
        coverUrl: row.cover_url,
        trackNumber: null,
        sourceProvider: row.source_provider,
        sourceSongId: row.source_song_id,
        createdAt: row.created_at,
      })
    }

    songsByPlaylistId.set(row.playlist_id, existing)
  }

  return playlists.map((playlist) => ({
    ...playlist,
    songs: songsByPlaylistId.get(playlist.id) ?? [],
  }))
}

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

export const listPlaylistsWithSongsForCurrentUser = async (): Promise<PlaylistWithShares[]> => {
  const userId = await requireAuthenticatedUserId()

  const { data: playlistRows, error: playlistsError } = await supabase
    .from('playlists')
    .select('id, name, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  throwIfError(playlistsError, 'Failed to list playlists')

  const playlistsWithSongs = await hydratePlaylistsWithSongs(playlistRows ?? [])
  if (playlistsWithSongs.length === 0) {
    return []
  }

  const playlistIds = playlistsWithSongs.map((playlist) => playlist.id)
  const { data: shareRows, error: sharesError } = await supabase
    .from('playlist_shares')
    .select('playlist_id, shared_with_user_id, created_at')
    .eq('owner_user_id', userId)
    .in('playlist_id', playlistIds)
    .order('created_at', { ascending: true })

  throwIfError(sharesError, 'Failed to load playlist shares')

  const sharedUserIds = Array.from(
    new Set((shareRows ?? []).map((row) => row.shared_with_user_id)),
  )

  const profileByUserId = new Map<string, { username: string | null; friendCode: string | null }>()
  if (sharedUserIds.length > 0) {
    const { data: profileRows, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, username, friend_code')
      .in('user_id', sharedUserIds)

    throwIfError(profilesError, 'Failed to load shared friend profiles')

    for (const row of profileRows ?? []) {
      profileByUserId.set(row.user_id, {
        username: row.username,
        friendCode: row.friend_code,
      })
    }
  }

  const sharedWithByPlaylistId = new Map<string, PlaylistShareRecipient[]>()
  for (const row of shareRows ?? []) {
    const existing = sharedWithByPlaylistId.get(row.playlist_id) ?? []
    const profile = profileByUserId.get(row.shared_with_user_id)

    existing.push({
      friendUserId: row.shared_with_user_id,
      friendUsername: profile?.username ?? null,
      friendCode: profile?.friendCode ?? null,
      sharedAt: row.created_at,
    })

    sharedWithByPlaylistId.set(row.playlist_id, existing)
  }

  for (const recipients of sharedWithByPlaylistId.values()) {
    recipients.sort((left, right) => {
      const leftName = left.friendUsername?.trim() || left.friendCode || left.friendUserId
      const rightName = right.friendUsername?.trim() || right.friendCode || right.friendUserId
      return leftName.localeCompare(rightName)
    })
  }

  return playlistsWithSongs.map((playlist) => ({
    ...playlist,
    sharedWith: sharedWithByPlaylistId.get(playlist.id) ?? [],
  }))
}

export const listSharedPlaylistsWithSongsForCurrentUser = async (): Promise<SharedPlaylistWithSongs[]> => {
  const userId = await requireAuthenticatedUserId()

  const { data: shareRows, error: sharesError } = await supabase
    .from('playlist_shares')
    .select('playlist_id, owner_user_id, created_at')
    .eq('shared_with_user_id', userId)
    .order('created_at', { ascending: false })

  throwIfError(sharesError, 'Failed to load shared playlists')

  if (!shareRows || shareRows.length === 0) {
    return []
  }

  const shareByPlaylistId = new Map(shareRows.map((row) => [row.playlist_id, row]))
  const playlistIds = Array.from(shareByPlaylistId.keys())

  const { data: playlistRows, error: playlistsError } = await supabase
    .from('playlists')
    .select('id, name, created_at')
    .in('id', playlistIds)
    .order('created_at', { ascending: false })

  throwIfError(playlistsError, 'Failed to load shared playlist records')

  const playlistsWithSongs = await hydratePlaylistsWithSongs(playlistRows ?? [])
  if (playlistsWithSongs.length === 0) {
    return []
  }

  const ownerUserIds = Array.from(new Set(shareRows.map((row) => row.owner_user_id)))
  const ownerProfileByUserId = new Map<string, { username: string | null; friendCode: string | null }>()

  if (ownerUserIds.length > 0) {
    const { data: ownerProfileRows, error: ownerProfilesError } = await supabase
      .from('profiles')
      .select('user_id, username, friend_code')
      .in('user_id', ownerUserIds)

    throwIfError(ownerProfilesError, 'Failed to load shared playlist owners')

    for (const row of ownerProfileRows ?? []) {
      ownerProfileByUserId.set(row.user_id, {
        username: row.username,
        friendCode: row.friend_code,
      })
    }
  }

  const sharedPlaylists = playlistsWithSongs.flatMap((playlist) => {
    const shareRow = shareByPlaylistId.get(playlist.id)
    if (!shareRow) {
      return []
    }

    const ownerProfile = ownerProfileByUserId.get(shareRow.owner_user_id)
    return [
      {
        ...playlist,
        ownerUserId: shareRow.owner_user_id,
        ownerUsername: ownerProfile?.username ?? null,
        ownerFriendCode: ownerProfile?.friendCode ?? null,
        sharedAt: shareRow.created_at,
      },
    ]
  })

  sharedPlaylists.sort((left, right) => right.sharedAt.localeCompare(left.sharedAt))
  return sharedPlaylists
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

export const sharePlaylistWithFriendForCurrentUser = async (params: SharePlaylistParams): Promise<void> => {
  const userId = await requireAuthenticatedUserId()
  const playlistId = params.playlistId.trim()
  const friendUserId = params.friendUserId.trim()

  if (!playlistId) {
    throw new Error('Missing playlist identifier.')
  }

  if (!friendUserId) {
    throw new Error('Please choose a friend to share with.')
  }

  if (friendUserId === userId) {
    throw new Error('You cannot share a playlist with yourself.')
  }

  await ensurePlaylistOwnedByUser(playlistId, userId)

  const [firstUserId, secondUserId] = userId < friendUserId ? [userId, friendUserId] : [friendUserId, userId]
  const { data: friendshipRow, error: friendshipError } = await supabase
    .from('friendships')
    .select('user_id')
    .eq('user_id', firstUserId)
    .eq('friend_user_id', secondUserId)
    .maybeSingle()

  throwIfError(friendshipError, 'Failed to validate friendship')

  if (!friendshipRow) {
    throw new Error('You can only share playlists with friends.')
  }

  const { error } = await supabase.from('playlist_shares').insert({
    playlist_id: playlistId,
    owner_user_id: userId,
    shared_with_user_id: friendUserId,
  })

  if (error?.code === '23505') {
    throw new Error('That friend already has access to this playlist.')
  }

  throwIfError(error, 'Failed to share playlist')
}

export const unsharePlaylistWithFriendForCurrentUser = async (params: SharePlaylistParams): Promise<void> => {
  const userId = await requireAuthenticatedUserId()
  const playlistId = params.playlistId.trim()
  const friendUserId = params.friendUserId.trim()

  if (!playlistId) {
    throw new Error('Missing playlist identifier.')
  }

  if (!friendUserId) {
    throw new Error('Missing friend identifier.')
  }

  await ensurePlaylistOwnedByUser(playlistId, userId)

  const { error } = await supabase
    .from('playlist_shares')
    .delete()
    .eq('playlist_id', playlistId)
    .eq('owner_user_id', userId)
    .eq('shared_with_user_id', friendUserId)

  throwIfError(error, 'Failed to remove playlist share')
}

export const addSongToPlaylistForCurrentUser = async (params: AddSongToPlaylistParams): Promise<void> => {
  const userId = await requireAuthenticatedUserId()
  const playlistId = params.playlistId.trim()

  if (!playlistId) {
    throw new Error('Please choose a playlist first.')
  }

  await ensurePlaylistOwnedByUser(playlistId, userId)

  if ('userSavedAlbumId' in params) {
    const userSavedAlbumId = params.userSavedAlbumId.trim()
    if (!userSavedAlbumId) {
      throw new Error('Missing saved album identifier.')
    }

    if (!Number.isInteger(params.trackNumber) || params.trackNumber <= 0) {
      throw new Error('Track number must be a positive integer.')
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
    return
  }

  const sourceSongId = params.sourceSongId.trim()
  const songName = params.songName.trim()
  const artistName = params.artistName.trim()
  const sourceProvider = params.sourceProvider.trim()

  if (!sourceSongId) {
    throw new Error('Missing source song identifier.')
  }

  if (!songName) {
    throw new Error('Song name is required.')
  }

  if (!artistName) {
    throw new Error('Artist name is required.')
  }

  if (!sourceProvider) {
    throw new Error('Source provider is required.')
  }

  const { error } = await supabase.from('playlist_songs').insert({
    playlist_id: playlistId,
    user_saved_album_id: null,
    track_number: null,
    source_provider: sourceProvider,
    source_song_id: sourceSongId,
    song_name: songName,
    artist_name: artistName,
    album_title: params.albumTitle?.trim() || null,
    cover_url: params.coverUrl?.trim() || null,
  })

  if (error?.code === '23505') {
    throw new Error('That song is already in this playlist.')
  }

  throwIfError(error, 'Failed to add song to playlist')
}
