import { supabase } from '../supabaseClient'
import { listSavedAlbumsForCurrentUser } from './reviewsData'
import { listAllTagsForCurrentUser } from './tagsData'
import { listAllLyricsOverridesForCurrentUser } from './lyricsData'

export type SearchSongRecord = {
  userSavedAlbumId: string
  albumId: string
  albumTitle: string
  artistName: string
  coverUrl: string | null
  savedAt: string
  trackNumber: number
  trackTitle: string
  lyrics: string
  reviewNotes: string
  score: number | null
  isInterlude: boolean
  tags: string[]
}

const toTrackKey = (savedAlbumId: string, trackNumber: number) => `${savedAlbumId}:${trackNumber}`

const throwIfError = (error: { message: string } | null, context: string) => {
  if (error) {
    throw new Error(`${context}: ${error.message}`)
  }
}

export const listSearchSongsForCurrentUser = async (): Promise<SearchSongRecord[]> => {
  const savedAlbums = await listSavedAlbumsForCurrentUser()

  if (savedAlbums.length === 0) {
    return []
  }

  const savedAlbumIds = savedAlbums.map((album) => album.userSavedAlbumId)
  const albumIds = savedAlbums.map((album) => album.albumId)
  const savedAlbumByAlbumId = new Map(savedAlbums.map((album) => [album.albumId, album]))

  const [
    { data: reviewRows, error: reviewError },
    { data: trackRows, error: trackError },
    allTags,
    allLyricsOverrides,
  ] = await Promise.all([
    supabase
      .from('review_sections')
      .select('user_saved_album_id, track_number, is_interlude, notes, score')
      .in('user_saved_album_id', savedAlbumIds)
      .eq('section_type', 'track'),
    supabase.from('album_tracks').select('album_id, track_number, title, lyrics').in('album_id', albumIds),
    listAllTagsForCurrentUser(),
    listAllLyricsOverridesForCurrentUser(),
  ])

  throwIfError(reviewError, 'Failed to load review sections for search')
  throwIfError(trackError, 'Failed to load track metadata for search')

  const toTagKey = (savedAlbumId: string, trackNumber: number) => `${savedAlbumId}:${trackNumber}`

  const reviewBySavedAlbumAndTrack = new Map<
    string,
    {
      isInterlude: boolean
      notes: string
      score: number | null
    }
  >()

  for (const row of reviewRows ?? []) {
    if (row.track_number === null) {
      continue
    }

    reviewBySavedAlbumAndTrack.set(toTrackKey(row.user_saved_album_id, row.track_number), {
      isInterlude: row.is_interlude,
      notes: row.notes,
      score: row.score,
    })
  }

  const songs: SearchSongRecord[] = []

  for (const track of trackRows ?? []) {
    const album = savedAlbumByAlbumId.get(track.album_id)
    if (!album) {
      continue
    }

    const review = reviewBySavedAlbumAndTrack.get(toTrackKey(album.userSavedAlbumId, track.track_number))

    songs.push({
      userSavedAlbumId: album.userSavedAlbumId,
      albumId: album.albumId,
      albumTitle: album.title,
      artistName: album.artistName,
      coverUrl: album.coverUrl,
      savedAt: album.savedAt,
      trackNumber: track.track_number,
      trackTitle: track.title,
      lyrics: allLyricsOverrides[toTagKey(album.userSavedAlbumId, track.track_number)] ?? track.lyrics,
      reviewNotes: review?.notes ?? '',
      score: review?.score ?? null,
      isInterlude: review?.isInterlude ?? false,
      tags: allTags[toTagKey(album.userSavedAlbumId, track.track_number)] ?? [],
    })
  }

  songs.sort((left, right) => {
    if (left.artistName !== right.artistName) {
      return left.artistName.localeCompare(right.artistName)
    }

    if (left.albumTitle !== right.albumTitle) {
      return left.albumTitle.localeCompare(right.albumTitle)
    }

    return left.trackNumber - right.trackNumber
  })

  return songs
}
