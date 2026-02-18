import { supabase } from '../supabaseClient'
import { listSavedAlbumsForCurrentUser, type SavedAlbumCard } from './reviewsData'

export type RankedAlbumStat = {
  userSavedAlbumId: string
  albumId: string
  title: string
  artistName: string
  coverUrl: string | null
  value: number
}

export type RankedSongStat = {
  userSavedAlbumId: string
  albumId: string
  albumTitle: string
  artistName: string
  coverUrl: string | null
  trackNumber: number
  trackTitle: string
  value: number
}

export type MyStatsData = {
  topAlbumsByConclusionScore: RankedAlbumStat[]
  topAlbumsByTrackAverage: RankedAlbumStat[]
  topSongsByScore: RankedSongStat[]
  topInterludeSongs: RankedSongStat[]
}

type TrackScoreAccumulator = {
  totalScore: number
  totalCount: number
}

const throwIfError = (error: { message: string } | null, context: string) => {
  if (error) {
    throw new Error(`${context}: ${error.message}`)
  }
}

const toRankedAlbumStat = (album: SavedAlbumCard, value: number): RankedAlbumStat => ({
  userSavedAlbumId: album.userSavedAlbumId,
  albumId: album.albumId,
  title: album.title,
  artistName: album.artistName,
  coverUrl: album.coverUrl,
  value,
})

const toTrackKey = (albumId: string, trackNumber: number) => `${albumId}:${trackNumber}`

const toRankedSongStat = (
  album: SavedAlbumCard,
  trackNumber: number,
  trackTitle: string,
  value: number,
): RankedSongStat => ({
  userSavedAlbumId: album.userSavedAlbumId,
  albumId: album.albumId,
  albumTitle: album.title,
  artistName: album.artistName,
  coverUrl: album.coverUrl,
  trackNumber,
  trackTitle,
  value,
})

const sortByValueDescending = (left: RankedAlbumStat, right: RankedAlbumStat) => {
  if (right.value !== left.value) {
    return right.value - left.value
  }

  if (left.artistName !== right.artistName) {
    return left.artistName.localeCompare(right.artistName)
  }

  return left.title.localeCompare(right.title)
}

const sortSongsByValueDescending = (left: RankedSongStat, right: RankedSongStat) => {
  if (right.value !== left.value) {
    return right.value - left.value
  }

  if (left.artistName !== right.artistName) {
    return left.artistName.localeCompare(right.artistName)
  }

  if (left.albumTitle !== right.albumTitle) {
    return left.albumTitle.localeCompare(right.albumTitle)
  }

  return left.trackNumber - right.trackNumber
}

export const getMyStatsForCurrentUser = async (): Promise<MyStatsData> => {
  const savedAlbums = await listSavedAlbumsForCurrentUser()

  if (savedAlbums.length === 0) {
    return {
      topAlbumsByConclusionScore: [],
      topAlbumsByTrackAverage: [],
      topSongsByScore: [],
      topInterludeSongs: [],
    }
  }

  const savedAlbumIds = savedAlbums.map((album) => album.userSavedAlbumId)
  const albumIds = savedAlbums.map((album) => album.albumId)
  const savedAlbumById = new Map(savedAlbums.map((album) => [album.userSavedAlbumId, album]))

  const [{ data: reviewSections, error: reviewSectionsError }, { data: trackRows, error: trackRowsError }] =
    await Promise.all([
      supabase
        .from('review_sections')
        .select('user_saved_album_id, section_type, track_number, is_interlude, score')
        .in('user_saved_album_id', savedAlbumIds)
        .not('score', 'is', null),
      supabase.from('album_tracks').select('album_id, track_number, title').in('album_id', albumIds),
    ])

  throwIfError(reviewSectionsError, 'Failed to load stats source data')
  throwIfError(trackRowsError, 'Failed to load track metadata for stats')

  const conclusionScoreBySavedAlbumId = new Map<string, number>()
  const trackAccumulatorBySavedAlbumId = new Map<string, TrackScoreAccumulator>()
  const trackTitleByAlbumAndNumber = new Map<string, string>()
  const topSongCandidates: RankedSongStat[] = []
  const topInterludeCandidates: RankedSongStat[] = []

  for (const track of trackRows ?? []) {
    trackTitleByAlbumAndNumber.set(toTrackKey(track.album_id, track.track_number), track.title)
  }

  for (const section of reviewSections ?? []) {
    const score = section.score
    if (score === null) {
      continue
    }

    if (section.section_type === 'conclusion') {
      const currentMax = conclusionScoreBySavedAlbumId.get(section.user_saved_album_id)
      if (currentMax === undefined || score > currentMax) {
        conclusionScoreBySavedAlbumId.set(section.user_saved_album_id, score)
      }
      continue
    }

    const savedAlbum = savedAlbumById.get(section.user_saved_album_id)
    if (!savedAlbum || section.track_number === null) {
      continue
    }

    const trackTitle =
      trackTitleByAlbumAndNumber.get(toTrackKey(savedAlbum.albumId, section.track_number)) ??
      `Track ${section.track_number}`
    const rankedSong = toRankedSongStat(savedAlbum, section.track_number, trackTitle, score)

    if (section.is_interlude) {
      topInterludeCandidates.push(rankedSong)
      continue
    }

    topSongCandidates.push(rankedSong)

    const existing = trackAccumulatorBySavedAlbumId.get(section.user_saved_album_id)
    if (existing) {
      existing.totalScore += score
      existing.totalCount += 1
      continue
    }

    trackAccumulatorBySavedAlbumId.set(section.user_saved_album_id, {
      totalScore: score,
      totalCount: 1,
    })
  }

  const topAlbumsByConclusionScore = Array.from(conclusionScoreBySavedAlbumId.entries())
    .flatMap(([savedAlbumId, score]) => {
      const album = savedAlbumById.get(savedAlbumId)
      if (!album) {
        return []
      }

      return [toRankedAlbumStat(album, score)]
    })
    .sort(sortByValueDescending)
    .slice(0, 10)

  const topAlbumsByTrackAverage = Array.from(trackAccumulatorBySavedAlbumId.entries())
    .flatMap(([savedAlbumId, accumulator]) => {
      if (accumulator.totalCount === 0) {
        return []
      }

      const album = savedAlbumById.get(savedAlbumId)
      if (!album) {
        return []
      }

      const averageScore = accumulator.totalScore / accumulator.totalCount
      return [toRankedAlbumStat(album, averageScore)]
    })
    .sort(sortByValueDescending)
    .slice(0, 10)

  const topSongsByScore = topSongCandidates.sort(sortSongsByValueDescending).slice(0, 10)

  const topInterludeSongs = topInterludeCandidates.sort(sortSongsByValueDescending).slice(0, 10)

  return {
    topAlbumsByConclusionScore,
    topAlbumsByTrackAverage,
    topSongsByScore,
    topInterludeSongs,
  }
}
