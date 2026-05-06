import type { Json } from './database.types'
import { supabase } from '../supabaseClient'

export type ReviewSectionType = 'track' | 'conclusion'

export type SavedAlbumCard = {
  userSavedAlbumId: string
  albumId: string
  title: string
  artistName: string
  artistNames: string[]
  coverUrl: string | null
  releaseDate: string | null
  totalTracks: number
  savedAt: string
}

const extractArtistNames = (artistName: string, metadata: Json): string[] => {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const artists = (metadata as Record<string, Json>).artists
    if (Array.isArray(artists) && artists.length > 0) {
      const names = artists.filter((a): a is string => typeof a === 'string')
      if (names.length > 0) return names
    }
  }
  return [artistName]
}

export type AlbumTrack = {
  id: string
  albumId: string
  trackNumber: number
  title: string
  durationSeconds: number | null
  lyrics: string
}

export type ReviewSection = {
  id: string
  userSavedAlbumId: string
  sectionType: ReviewSectionType
  trackNumber: number | null
  isInterlude: boolean
  notesLyrically: string
  notesSonically: string
  score: number | null
}

export type AlbumWorkspace = {
  userSavedAlbumId: string
  album: {
    id: string
    title: string
    artistName: string
    artistNames: string[]
    coverUrl: string | null
    releaseDate: string | null
    totalTracks: number
  }
  tracks: AlbumTrack[]
  sections: ReviewSection[]
}

export type SaveAlbumTrackInput = {
  trackNumber: number
  title: string
  durationSeconds?: number | null
  lyrics?: string
  metadata?: Json
}

export type SaveAlbumInput = {
  sourceProvider: string
  sourceAlbumId: string
  title: string
  artistName: string
  coverUrl?: string | null
  releaseDate?: string | null
  metadata?: Json
  tracks: SaveAlbumTrackInput[]
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

const listSavedAlbumsByUserId = async (userId: string): Promise<SavedAlbumCard[]> => {
  const { data: savedRows, error: savedRowsError } = await supabase
    .from('user_saved_albums')
    .select('id, album_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  throwIfError(savedRowsError, 'Failed to list saved albums')

  const rows = savedRows ?? []
  if (rows.length === 0) {
    return []
  }

  const albumIds = rows.map((row) => row.album_id)

  const { data: albumRows, error: albumsError } = await supabase
    .from('albums')
    .select('id, title, artist_name, cover_url, release_date, total_tracks, metadata')
    .in('id', albumIds)

  throwIfError(albumsError, 'Failed to load album metadata')

  const albumById = new Map((albumRows ?? []).map((album) => [album.id, album]))

  return rows
    .flatMap((row) => {
      const album = albumById.get(row.album_id)
      if (!album) {
        return []
      }

      return {
        userSavedAlbumId: row.id,
        albumId: album.id,
        title: album.title,
        artistName: album.artist_name,
        artistNames: extractArtistNames(album.artist_name, album.metadata),
        coverUrl: album.cover_url,
        releaseDate: album.release_date,
        totalTracks: album.total_tracks,
        savedAt: row.created_at,
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title))
}

export const listSavedAlbumsForCurrentUser = async (): Promise<SavedAlbumCard[]> => {
  const userId = await requireAuthenticatedUserId()
  return listSavedAlbumsByUserId(userId)
}

export const listSavedAlbumsForUser = async (userId: string): Promise<SavedAlbumCard[]> => {
  await requireAuthenticatedUserId()
  return listSavedAlbumsByUserId(userId)
}

const getAlbumWorkspaceByUserId = async (
  userId: string,
  userSavedAlbumId: string,
): Promise<AlbumWorkspace | null> => {
  const { data: savedAlbumRow, error: savedAlbumError } = await supabase
    .from('user_saved_albums')
    .select('id, user_id, album_id')
    .eq('id', userSavedAlbumId)
    .eq('user_id', userId)
    .maybeSingle()

  throwIfError(savedAlbumError, 'Failed to load saved album')

  if (!savedAlbumRow) {
    return null
  }

  const { data: albumRow, error: albumError } = await supabase
    .from('albums')
    .select('id, title, artist_name, cover_url, release_date, total_tracks, metadata')
    .eq('id', savedAlbumRow.album_id)
    .maybeSingle()

  throwIfError(albumError, 'Failed to load album metadata')

  if (!albumRow) {
    return null
  }

  const [{ data: trackRows, error: tracksError }, { data: sectionRows, error: sectionsError }] =
    await Promise.all([
      supabase
        .from('album_tracks')
        .select('id, album_id, track_number, title, duration_seconds, lyrics')
        .eq('album_id', albumRow.id)
        .order('track_number', { ascending: true }),
      supabase
        .from('review_sections')
        .select('id, user_saved_album_id, section_type, track_number, is_interlude, notes_lyrically, notes_sonically, score')
        .eq('user_saved_album_id', userSavedAlbumId),
    ])

  throwIfError(tracksError, 'Failed to load album tracks')
  throwIfError(sectionsError, 'Failed to load review sections')

  return {
    userSavedAlbumId,
    album: {
      id: albumRow.id,
      title: albumRow.title,
      artistName: albumRow.artist_name,
      artistNames: extractArtistNames(albumRow.artist_name, albumRow.metadata),
      coverUrl: albumRow.cover_url,
      releaseDate: albumRow.release_date,
      totalTracks: albumRow.total_tracks,
    },
    tracks: (trackRows ?? []).map((track) => ({
      id: track.id,
      albumId: track.album_id,
      trackNumber: track.track_number,
      title: track.title,
      durationSeconds: track.duration_seconds,
      lyrics: track.lyrics,
    })),
    sections: (sectionRows ?? []).map((section) => ({
      id: section.id,
      userSavedAlbumId: section.user_saved_album_id,
      sectionType: section.section_type,
      trackNumber: section.track_number,
      isInterlude: section.is_interlude,
      notesLyrically: section.notes_lyrically,
      notesSonically: section.notes_sonically,
      score: section.score,
    })),
  }
}

export const getAlbumWorkspaceForCurrentUser = async (
  userSavedAlbumId: string,
): Promise<AlbumWorkspace | null> => {
  const userId = await requireAuthenticatedUserId()
  return getAlbumWorkspaceByUserId(userId, userSavedAlbumId)
}

export const getAlbumWorkspaceForUser = async (
  userId: string,
  userSavedAlbumId: string,
): Promise<AlbumWorkspace | null> => {
  await requireAuthenticatedUserId()
  return getAlbumWorkspaceByUserId(userId, userSavedAlbumId)
}

export const saveAlbumForCurrentUser = async (input: SaveAlbumInput): Promise<string> => {
  const userId = await requireAuthenticatedUserId()

  const { data: albumRow, error: albumError } = await supabase
    .from('albums')
    .upsert(
      {
        source_provider: input.sourceProvider,
        source_album_id: input.sourceAlbumId,
        title: input.title,
        artist_name: input.artistName,
        cover_url: input.coverUrl ?? null,
        release_date: input.releaseDate ?? null,
        total_tracks: input.tracks.length,
        metadata: input.metadata ?? {},
      },
      { onConflict: 'source_provider,source_album_id' },
    )
    .select('id')
    .single()

  throwIfError(albumError, 'Failed to upsert album')

  if (!albumRow) {
    throw new Error('Album upsert succeeded but no album row was returned.')
  }

  const albumId = albumRow.id

  if (input.tracks.length > 0) {
    const trackPayload = input.tracks.map((track) => ({
      album_id: albumId,
      track_number: track.trackNumber,
      title: track.title,
      duration_seconds: track.durationSeconds ?? null,
      lyrics: track.lyrics ?? '',
      metadata: track.metadata ?? {},
    }))

    const { error: tracksUpsertError } = await supabase
      .from('album_tracks')
      .upsert(trackPayload, { onConflict: 'album_id,track_number' })

    throwIfError(tracksUpsertError, 'Failed to upsert album tracks')
  }

  const { data: savedAlbumRow, error: savedAlbumError } = await supabase
    .from('user_saved_albums')
    .upsert(
      {
        user_id: userId,
        album_id: albumId,
      },
      { onConflict: 'user_id,album_id' },
    )
    .select('id')
    .single()

  throwIfError(savedAlbumError, 'Failed to save album for user')

  if (!savedAlbumRow) {
    throw new Error('User-saved album upsert succeeded but no row was returned.')
  }

  return savedAlbumRow.id
}

const findSectionForTrack = async (userSavedAlbumId: string, trackNumber: number) => {
  const { data, error } = await supabase
    .from('review_sections')
    .select('id, score')
    .eq('user_saved_album_id', userSavedAlbumId)
    .eq('section_type', 'track')
    .eq('track_number', trackNumber)
    .maybeSingle()

  throwIfError(error, 'Failed to find track section')

  return data
}

const findConclusionSection = async (userSavedAlbumId: string) => {
  const { data, error } = await supabase
    .from('review_sections')
    .select('id')
    .eq('user_saved_album_id', userSavedAlbumId)
    .eq('section_type', 'conclusion')
    .maybeSingle()

  throwIfError(error, 'Failed to find conclusion section')

  return data
}

export const upsertTrackReviewSectionForCurrentUser = async (params: {
  userSavedAlbumId: string
  trackNumber: number
  isInterlude: boolean
  notesLyrically: string
  notesSonically: string
  score: number | null
}): Promise<void> => {
  await requireAuthenticatedUserId()

  if (params.trackNumber <= 0) {
    throw new Error('Track number must be greater than 0.')
  }

  const existing = await findSectionForTrack(params.userSavedAlbumId, params.trackNumber)

  if (existing) {
    const { error } = await supabase
      .from('review_sections')
      .update({
        is_interlude: params.isInterlude,
        notes_lyrically: params.notesLyrically,
        notes_sonically: params.notesSonically,
        score: params.score,
      })
      .eq('id', existing.id)

    throwIfError(error, 'Failed to update track section')

    if (existing.score !== params.score) {
      const { error: historyError } = await supabase
        .from('review_section_score_history')
        .insert({ review_section_id: existing.id, old_score: existing.score, new_score: params.score })

      throwIfError(historyError, 'Failed to record score history')
    }

    return
  }

  const { error } = await supabase.from('review_sections').insert({
    user_saved_album_id: params.userSavedAlbumId,
    section_type: 'track',
    track_number: params.trackNumber,
    is_interlude: params.isInterlude,
    notes_lyrically: params.notesLyrically,
    notes_sonically: params.notesSonically,
    score: params.score,
  })

  throwIfError(error, 'Failed to insert track section')
}

export const upsertConclusionSectionForCurrentUser = async (params: {
  userSavedAlbumId: string
  notesLyrically: string
  score: number | null
}): Promise<void> => {
  await requireAuthenticatedUserId()

  const existing = await findConclusionSection(params.userSavedAlbumId)

  if (existing) {
    const { error } = await supabase
      .from('review_sections')
      .update({ notes_lyrically: params.notesLyrically, score: params.score })
      .eq('id', existing.id)

    throwIfError(error, 'Failed to update conclusion section')
    return
  }

  const { error } = await supabase.from('review_sections').insert({
    user_saved_album_id: params.userSavedAlbumId,
    section_type: 'conclusion',
    track_number: null,
    notes_lyrically: params.notesLyrically,
    score: params.score,
  })

  throwIfError(error, 'Failed to insert conclusion section')
}

export const removeAlbumForCurrentUser = async (userSavedAlbumId: string): Promise<void> => {
  const userId = await requireAuthenticatedUserId()

  const { error } = await supabase
    .from('user_saved_albums')
    .delete()
    .eq('id', userSavedAlbumId)
    .eq('user_id', userId)

  throwIfError(error, 'Failed to remove album')
}

export const updateTrackLyrics = async (trackId: string, lyrics: string): Promise<void> => {
  await requireAuthenticatedUserId()

  const { error } = await supabase
    .from('album_tracks')
    .update({ lyrics })
    .eq('id', trackId)

  throwIfError(error, 'Failed to update track lyrics')
}

export const resetAlbumDataForCurrentUser = async (userSavedAlbumId: string): Promise<void> => {
  const userId = await requireAuthenticatedUserId()

  const { data: savedRow } = await supabase
    .from('user_saved_albums')
    .select('id')
    .eq('id', userSavedAlbumId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!savedRow) {
    throw new Error('Album not found or not owned by current user.')
  }

  await Promise.all([
    supabase.from('review_sections').delete().eq('user_saved_album_id', userSavedAlbumId),
    supabase.from('song_tags').delete().eq('user_id', userId).eq('user_saved_album_id', userSavedAlbumId),
    supabase.from('user_lyrics_overrides').delete().eq('user_id', userId).eq('user_saved_album_id', userSavedAlbumId),
  ])
}
