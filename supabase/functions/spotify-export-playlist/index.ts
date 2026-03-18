import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { requireSupabaseUser } from '../_shared/auth.ts'
import { getSpotifyEnv } from '../_shared/env.ts'
import { errorResponse, handleCorsPreflight, HttpError, jsonResponse, readJsonBody, requireMethod } from '../_shared/http.ts'
import {
  addTracksToSpotifyPlaylist,
  createSpotifyPlaylist,
  refreshSpotifyAccessToken,
  searchSpotifyTracks,
  type SpotifyTrackSearchItem,
} from '../_shared/spotify.ts'
import { getSupabaseAdminClient } from '../_shared/supabaseAdmin.ts'

type ExportRequestBody = {
  playlistId?: string
  makePublic?: boolean
}

type PlaylistSongRow = {
  id: string
  user_saved_album_id: string | null
  track_number: number | null
  source_provider: string | null
  source_song_id: string | null
  song_name: string | null
  artist_name: string | null
  album_title: string | null
  cover_url: string | null
  created_at: string
}

type ExportSong = {
  playlistSongId: string
  trackTitle: string
  artistName: string
  albumTitle: string | null
  sourceProvider: string | null
  sourceSongId: string | null
}

type UnmatchedSong = {
  playlistSongId: string
  trackTitle: string
  artistName: string
  albumTitle: string | null
  reason: string
}

type MatchResult =
  | {
      matched: true
      track: SpotifyTrackSearchItem
      score: number
      queryUsed: string
    }
  | {
      matched: false
      reason: string
      queryUsed: string
    }

const chunk = <T>(items: T[], size: number) => {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

const normalizeText = (value: string | null | undefined) =>
  (value ?? '')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const textTokens = (value: string | null | undefined) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return []
  }

  return normalized.split(/\s+/g).filter(Boolean)
}

const tokenOverlapRatio = (left: string | null | undefined, right: string | null | undefined) => {
  const leftTokens = new Set(textTokens(left))
  const rightTokens = new Set(textTokens(right))

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0
  }

  let overlap = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1
    }
  }

  return overlap / Math.max(leftTokens.size, rightTokens.size)
}

const titleSimilarityScore = (expected: string, candidate: string) => {
  const left = normalizeText(expected)
  const right = normalizeText(candidate)
  if (!left || !right) {
    return 0
  }

  if (left === right) {
    return 65
  }

  if (left.includes(right) || right.includes(left)) {
    return 50
  }

  return Math.round(tokenOverlapRatio(left, right) * 45)
}

const artistSimilarityScore = (expectedArtist: string, candidateArtists: string[]) => {
  const expected = normalizeText(expectedArtist)
  if (!expected) {
    return 0
  }

  let best = 0
  for (const candidate of candidateArtists) {
    const normalized = normalizeText(candidate)
    if (!normalized) {
      continue
    }

    if (normalized === expected) {
      best = Math.max(best, 30)
      continue
    }

    if (normalized.includes(expected) || expected.includes(normalized)) {
      best = Math.max(best, 22)
      continue
    }

    best = Math.max(best, Math.round(tokenOverlapRatio(expected, normalized) * 20))
  }

  return best
}

const albumSimilarityScore = (expectedAlbum: string | null, candidateAlbum: string | undefined) => {
  if (!expectedAlbum) {
    return 0
  }

  const left = normalizeText(expectedAlbum)
  const right = normalizeText(candidateAlbum)
  if (!left || !right) {
    return 0
  }

  if (left === right) {
    return 10
  }

  if (left.includes(right) || right.includes(left)) {
    return 6
  }

  return Math.round(tokenOverlapRatio(left, right) * 6)
}

const noisePenalty = (trackName: string) => {
  const normalized = normalizeText(trackName)
  if (!normalized) {
    return 0
  }

  let penalty = 0
  if (normalized.includes('karaoke')) {
    penalty += 12
  }
  if (normalized.includes('tribute')) {
    penalty += 8
  }
  if (normalized.includes('cover')) {
    penalty += 6
  }

  return penalty
}

const computeCandidateScore = (song: ExportSong, candidate: SpotifyTrackSearchItem) => {
  const titleScore = titleSimilarityScore(song.trackTitle, candidate.name)
  const artistScore = artistSimilarityScore(
    song.artistName,
    (candidate.artists ?? []).map((artist) => artist.name),
  )
  const albumScore = albumSimilarityScore(song.albumTitle, candidate.album?.name)
  const penalty = noisePenalty(candidate.name)
  return titleScore + artistScore + albumScore - penalty
}

const escapeSpotifyQueryTerm = (value: string) => value.replace(/"/g, ' ').trim()

const buildStructuredQuery = (song: ExportSong) => {
  const track = escapeSpotifyQueryTerm(song.trackTitle)
  const artist = escapeSpotifyQueryTerm(song.artistName)
  const album = song.albumTitle ? escapeSpotifyQueryTerm(song.albumTitle) : ''

  const parts = [`track:"${track}"`, `artist:"${artist}"`]
  if (album) {
    parts.push(`album:"${album}"`)
  }

  return parts.join(' ')
}

const buildFallbackQuery = (song: ExportSong) =>
  [song.trackTitle.trim(), song.artistName.trim(), song.albumTitle?.trim() ?? ''].filter(Boolean).join(' ')

const dedupeCandidates = (items: SpotifyTrackSearchItem[]) => {
  const seen = new Set<string>()
  const result: SpotifyTrackSearchItem[] = []

  for (const item of items) {
    if (!item.id || seen.has(item.id)) {
      continue
    }

    seen.add(item.id)
    result.push(item)
  }

  return result
}

const selectBestMatch = (song: ExportSong, candidates: SpotifyTrackSearchItem[]) => {
  let best: { track: SpotifyTrackSearchItem; score: number } | null = null

  for (const candidate of candidates) {
    const score = computeCandidateScore(song, candidate)
    if (!best || score > best.score) {
      best = { track: candidate, score }
    }
  }

  return best
}

const matchSongToSpotifyTrack = async (accessToken: string, song: ExportSong): Promise<MatchResult> => {
  const structuredQuery = buildStructuredQuery(song)
  const fallbackQuery = buildFallbackQuery(song)

  const structured = await searchSpotifyTracks({
    accessToken,
    query: structuredQuery,
    limit: 5,
  })

  let candidates = dedupeCandidates(structured.tracks?.items ?? [])
  let queryUsed = structuredQuery

  if (candidates.length === 0 && fallbackQuery && fallbackQuery !== structuredQuery) {
    const fallback = await searchSpotifyTracks({
      accessToken,
      query: fallbackQuery,
      limit: 8,
    })
    candidates = dedupeCandidates(fallback.tracks?.items ?? [])
    queryUsed = fallbackQuery
  }

  if (candidates.length === 0) {
    return {
      matched: false,
      reason: 'No Spotify search results.',
      queryUsed,
    }
  }

  const best = selectBestMatch(song, candidates)
  if (!best) {
    return {
      matched: false,
      reason: 'No usable Spotify search result.',
      queryUsed,
    }
  }

  // Conservative threshold to avoid obviously wrong matches.
  if (best.score < 60) {
    return {
      matched: false,
      reason: `Low-confidence match (${best.score}).`,
      queryUsed,
    }
  }

  return {
    matched: true,
    track: best.track,
    score: best.score,
    queryUsed,
  }
}

const parseScopeSet = (scopeText: string | null | undefined) =>
  new Set(
    (scopeText ?? '')
      .split(/\s+/g)
      .map((scope) => scope.trim())
      .filter(Boolean),
  )

const requireExportScope = (scopeText: string, makePublic: boolean) => {
  const scopes = parseScopeSet(scopeText)
  const requiredScope = makePublic ? 'playlist-modify-public' : 'playlist-modify-private'
  if (!scopes.has(requiredScope)) {
    throw new HttpError(
      409,
      `Spotify connection is missing "${requiredScope}". Reconnect Spotify and try again.`,
      'spotify_missing_scope',
    )
  }
}

const hydratePlaylistSongsForExport = async (supabase: ReturnType<typeof getSupabaseAdminClient>, playlistId: string) => {
  const { data: songRows, error: songRowsError } = await supabase
    .from('playlist_songs')
    .select(
      'id, user_saved_album_id, track_number, source_provider, source_song_id, song_name, artist_name, album_title, cover_url, created_at',
    )
    .eq('playlist_id', playlistId)
    .order('created_at', { ascending: true })

  if (songRowsError) {
    throw new HttpError(500, 'Failed to load playlist songs.', 'playlist_songs_lookup_failed', songRowsError)
  }

  const playlistSongs = (songRows ?? []) as PlaylistSongRow[]
  if (playlistSongs.length === 0) {
    return [] as ExportSong[]
  }

  const localRows = playlistSongs.filter(
    (row) => row.user_saved_album_id !== null && row.track_number !== null,
  )
  const userSavedAlbumIds = Array.from(new Set(localRows.map((row) => row.user_saved_album_id as string)))

  const savedAlbumById = new Map<string, { album_id: string }>()
  if (userSavedAlbumIds.length > 0) {
    const { data: savedAlbumRows, error: savedAlbumsError } = await supabase
      .from('user_saved_albums')
      .select('id, album_id')
      .in('id', userSavedAlbumIds)

    if (savedAlbumsError) {
      throw new HttpError(
        500,
        'Failed to load saved album metadata for playlist export.',
        'playlist_export_saved_albums_lookup_failed',
        savedAlbumsError,
      )
    }

    for (const row of savedAlbumRows ?? []) {
      savedAlbumById.set(row.id, { album_id: row.album_id })
    }
  }

  const albumIds = Array.from(new Set(Array.from(savedAlbumById.values()).map((row) => row.album_id)))
  const albumById = new Map<string, { title: string; artist_name: string; cover_url: string | null }>()
  if (albumIds.length > 0) {
    const { data: albumRows, error: albumsError } = await supabase
      .from('albums')
      .select('id, title, artist_name, cover_url')
      .in('id', albumIds)

    if (albumsError) {
      throw new HttpError(
        500,
        'Failed to load album metadata for playlist export.',
        'playlist_export_albums_lookup_failed',
        albumsError,
      )
    }

    for (const row of albumRows ?? []) {
      albumById.set(row.id, {
        title: row.title,
        artist_name: row.artist_name,
        cover_url: row.cover_url,
      })
    }
  }

  const trackTitleByAlbumTrack = new Map<string, string>()
  if (albumIds.length > 0) {
    const { data: trackRows, error: trackRowsError } = await supabase
      .from('album_tracks')
      .select('album_id, track_number, title')
      .in('album_id', albumIds)

    if (trackRowsError) {
      throw new HttpError(
        500,
        'Failed to load track metadata for playlist export.',
        'playlist_export_tracks_lookup_failed',
        trackRowsError,
      )
    }

    for (const row of trackRows ?? []) {
      trackTitleByAlbumTrack.set(`${row.album_id}:${row.track_number}`, row.title)
    }
  }

  const hydrated: ExportSong[] = []

  for (const row of playlistSongs) {
    if (row.user_saved_album_id && row.track_number) {
      const savedAlbum = savedAlbumById.get(row.user_saved_album_id)
      const album = savedAlbum ? albumById.get(savedAlbum.album_id) : null

      hydrated.push({
        playlistSongId: row.id,
        trackTitle:
          (savedAlbum ? trackTitleByAlbumTrack.get(`${savedAlbum.album_id}:${row.track_number}`) : null) ??
          row.song_name ??
          `Track ${row.track_number}`,
        artistName: album?.artist_name ?? row.artist_name ?? 'Unknown Artist',
        albumTitle: album?.title ?? row.album_title ?? null,
        sourceProvider: row.source_provider,
        sourceSongId: row.source_song_id,
      })

      continue
    }

    hydrated.push({
      playlistSongId: row.id,
      trackTitle: row.song_name ?? 'Unknown Song',
      artistName: row.artist_name ?? 'Unknown Artist',
      albumTitle: row.album_title ?? null,
      sourceProvider: row.source_provider,
      sourceSongId: row.source_song_id,
    })
  }

  return hydrated
}

serve(async (request) => {
  const preflight = handleCorsPreflight(request)
  if (preflight) {
    return preflight
  }

  let supabase = getSupabaseAdminClient()
  let exportRunId: string | null = null
  let destinationPlaylistId: string | null = null
  let destinationPlaylistUrl: string | null = null
  let totalSongs = 0

  const failRunIfCreated = async (error: unknown) => {
    if (!exportRunId) {
      return
    }

    const message = error instanceof Error ? error.message : 'Unexpected error.'
    await supabase
      .from('playlist_export_runs')
      .update({
        status: 'failed',
        total_songs: totalSongs,
        destination_playlist_id: destinationPlaylistId,
        destination_playlist_url: destinationPlaylistUrl,
        error_message: message,
        finished_at: new Date().toISOString(),
      })
      .eq('id', exportRunId)
  }

  try {
    requireMethod(request, ['POST'])
    const { user } = await requireSupabaseUser(request)
    const body = (await readJsonBody<ExportRequestBody>(request)) ?? {}

    const playlistId = body.playlistId?.trim()
    if (!playlistId) {
      throw new HttpError(400, 'playlistId is required.', 'missing_playlist_id')
    }

    const makePublic = body.makePublic === true

    const { data: playlistRow, error: playlistError } = await supabase
      .from('playlists')
      .select('id, name')
      .eq('id', playlistId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (playlistError) {
      throw new HttpError(500, 'Failed to load playlist.', 'playlist_lookup_failed', playlistError)
    }

    if (!playlistRow) {
      throw new HttpError(404, 'Playlist not found.', 'playlist_not_found')
    }

    const { data: connectionRow, error: connectionError } = await supabase
      .from('spotify_connections')
      .select('user_id, spotify_user_id, scope, refresh_token')
      .eq('user_id', user.id)
      .maybeSingle()

    if (connectionError) {
      throw new HttpError(500, 'Failed to load Spotify connection.', 'spotify_connection_lookup_failed', connectionError)
    }

    if (!connectionRow) {
      throw new HttpError(409, 'Connect Spotify before exporting a playlist.', 'spotify_not_connected')
    }

    requireExportScope(connectionRow.scope, makePublic)

    const songs = await hydratePlaylistSongsForExport(supabase, playlistId)
    totalSongs = songs.length

    const { data: exportRun, error: exportRunError } = await supabase
      .from('playlist_export_runs')
      .insert({
        user_id: user.id,
        source_playlist_id: playlistId,
        destination_provider: 'spotify',
        status: 'running',
        total_songs: totalSongs,
        request_metadata: {
          makePublic,
          playlistName: playlistRow.name,
        },
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (exportRunError || !exportRun) {
      throw new HttpError(500, 'Failed to create export run.', 'playlist_export_run_insert_failed', exportRunError)
    }

    exportRunId = exportRun.id

    const spotifyEnv = getSpotifyEnv()
    const tokenResponse = await refreshSpotifyAccessToken({
      clientId: spotifyEnv.clientId,
      clientSecret: spotifyEnv.clientSecret,
      refreshToken: connectionRow.refresh_token,
    })

    if (tokenResponse.refresh_token && tokenResponse.refresh_token !== connectionRow.refresh_token) {
      await supabase
        .from('spotify_connections')
        .update({
          refresh_token: tokenResponse.refresh_token,
          scope: tokenResponse.scope || connectionRow.scope,
          last_connected_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
    }

    console.log('[export] token scope after refresh:', tokenResponse.scope)
    console.log('[export] spotify_user_id from db:', connectionRow.spotify_user_id)

    const meCheck = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
    })
    const meBody = await meCheck.json()
    console.log('[export] /v1/me status:', meCheck.status, 'body:', JSON.stringify(meBody))

    const createdPlaylist = await createSpotifyPlaylist({
      accessToken: tokenResponse.access_token,
      spotifyUserId: connectionRow.spotify_user_id,
      name: playlistRow.name,
      description: `Exported from Music Organizer on ${new Date().toISOString()}`,
      isPublic: makePublic,
    })

    destinationPlaylistId = createdPlaylist.id
    destinationPlaylistUrl = createdPlaylist.external_urls?.spotify ?? null

    const matchedUris: string[] = []
    const unmatchedSongs: UnmatchedSong[] = []
    const matchedSongDetails: Array<{
      playlistSongId: string
      spotifyTrackId: string
      spotifyTrackUri: string
      spotifyTrackName: string
      confidenceScore: number
      queryUsed: string
    }> = []

    for (const song of songs) {
      const match = await matchSongToSpotifyTrack(tokenResponse.access_token, song)

      if (!match.matched) {
        unmatchedSongs.push({
          playlistSongId: song.playlistSongId,
          trackTitle: song.trackTitle,
          artistName: song.artistName,
          albumTitle: song.albumTitle,
          reason: match.reason,
        })
        continue
      }

      matchedUris.push(match.track.uri)
      matchedSongDetails.push({
        playlistSongId: song.playlistSongId,
        spotifyTrackId: match.track.id,
        spotifyTrackUri: match.track.uri,
        spotifyTrackName: match.track.name,
        confidenceScore: match.score,
        queryUsed: match.queryUsed,
      })
    }

    for (const uriBatch of chunk(matchedUris, 100)) {
      await addTracksToSpotifyPlaylist({
        accessToken: tokenResponse.access_token,
        playlistId: createdPlaylist.id,
        trackUris: uriBatch,
      })
    }

    const addedSongs = matchedUris.length
    const unmatchedCount = unmatchedSongs.length
    const finalStatus =
      unmatchedCount === 0 ? 'succeeded' : addedSongs > 0 ? 'partial' : 'failed'

    const resultMetadata = {
      matchedSongDetails,
      unmatchedSongs: unmatchedSongs.slice(0, 100),
      unmatchedSongCount: unmatchedCount,
    }

    const { error: finalizeError } = await supabase
      .from('playlist_export_runs')
      .update({
        destination_playlist_id: destinationPlaylistId,
        destination_playlist_url: destinationPlaylistUrl,
        status: finalStatus,
        matched_songs: addedSongs,
        added_songs: addedSongs,
        unmatched_songs: unmatchedCount,
        skipped_songs: 0,
        error_message: unmatchedCount > 0 && addedSongs === 0 ? 'No songs could be matched to Spotify tracks.' : null,
        result_metadata: resultMetadata,
        finished_at: new Date().toISOString(),
      })
      .eq('id', exportRunId)

    if (finalizeError) {
      throw new HttpError(500, 'Failed to finalize export run.', 'playlist_export_run_finalize_failed', finalizeError)
    }

    return jsonResponse({
      playlist: {
        id: playlistRow.id,
        name: playlistRow.name,
      },
      destinationPlaylist: {
        id: destinationPlaylistId,
        url: destinationPlaylistUrl,
        name: createdPlaylist.name,
        public: makePublic,
      },
      exportRun: {
        id: exportRunId,
        status: finalStatus,
      },
      summary: {
        totalSongs,
        matchedSongs: addedSongs,
        addedSongs,
        unmatchedSongs: unmatchedCount,
        skippedSongs: 0,
      },
      unmatchedSongs: unmatchedSongs.slice(0, 20),
    })
  } catch (error) {
    await failRunIfCreated(error)
    return errorResponse(error)
  }
})

