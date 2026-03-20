import { supabase } from '../supabaseClient'
import { listSavedAlbumsForCurrentUser, listSavedAlbumsForUser, type SavedAlbumCard } from './reviewsData'

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

export type FavoriteWordStat = {
  word: string
  count: number
}

export type RankedArtistStat = {
  artistName: string
  value: number
  albumCount: number
}

export type MyStatsData = {
  topAlbumsByConclusionScore: RankedAlbumStat[]
  topAlbumsByTrackAverage: RankedAlbumStat[]
  topSongsByScore: RankedSongStat[]
  topInterludeSongs: RankedSongStat[]
  topAlbumsByWordsWritten: RankedAlbumStat[]
  topSongsByWordsWritten: RankedSongStat[]
  grandTotalWordsWritten: number
  favoriteWords: FavoriteWordStat[]
  topArtistsByScore: RankedArtistStat[]
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

const countWords = (text: string): number => {
  return tokenizeWords(text).length
}

const tokenizeWords = (text: string): string[] => {
  const tokens = text.toLowerCase().match(/[a-z']+/g) ?? []
  return tokens.filter((token) => /[a-z]/.test(token))
}

const buildStatsFromSavedAlbums = async (savedAlbums: SavedAlbumCard[]): Promise<MyStatsData> => {
  if (savedAlbums.length === 0) {
    return {
      topAlbumsByConclusionScore: [],
      topAlbumsByTrackAverage: [],
      topSongsByScore: [],
      topInterludeSongs: [],
      topAlbumsByWordsWritten: [],
      topSongsByWordsWritten: [],
      grandTotalWordsWritten: 0,
      favoriteWords: [],
      topArtistsByScore: [],
    }
  }

  const savedAlbumIds = savedAlbums.map((album) => album.userSavedAlbumId)
  const albumIds = savedAlbums.map((album) => album.albumId)
  const savedAlbumById = new Map(savedAlbums.map((album) => [album.userSavedAlbumId, album]))

  const [{ data: reviewSections, error: reviewSectionsError }, { data: trackRows, error: trackRowsError }] =
    await Promise.all([
      supabase
        .from('review_sections')
        .select('user_saved_album_id, section_type, track_number, is_interlude, notes, score')
        .in('user_saved_album_id', savedAlbumIds),
      supabase.from('album_tracks').select('album_id, track_number, title').in('album_id', albumIds),
    ])

  throwIfError(reviewSectionsError, 'Failed to load stats source data')
  throwIfError(trackRowsError, 'Failed to load track metadata for stats')

  const conclusionScoreBySavedAlbumId = new Map<string, number>()
  const trackAccumulatorBySavedAlbumId = new Map<string, TrackScoreAccumulator>()
  const trackTitleByAlbumAndNumber = new Map<string, string>()
  const artistScoreAccumulator = new Map<string, { totalScore: number; albumCount: number }>()
  const wordsBySavedAlbumId = new Map<string, number>()
  const wordsBySavedAlbumTrackKey = new Map<string, { savedAlbumId: string; trackNumber: number; words: number }>()
  const wordFrequency = new Map<string, number>()
  const topSongCandidates: RankedSongStat[] = []
  const topInterludeCandidates: RankedSongStat[] = []

  for (const track of trackRows ?? []) {
    trackTitleByAlbumAndNumber.set(toTrackKey(track.album_id, track.track_number), track.title)
  }

  for (const section of reviewSections ?? []) {
    const wordsWritten = countWords(section.notes)
    if (wordsWritten > 0) {
      const currentAlbumWords = wordsBySavedAlbumId.get(section.user_saved_album_id) ?? 0
      wordsBySavedAlbumId.set(section.user_saved_album_id, currentAlbumWords + wordsWritten)

      for (const token of tokenizeWords(section.notes)) {
        const currentFrequency = wordFrequency.get(token) ?? 0
        wordFrequency.set(token, currentFrequency + 1)
      }

      if (section.section_type === 'track' && section.track_number !== null) {
        const trackKey = `${section.user_saved_album_id}:${section.track_number}`
        const currentTrackWords = wordsBySavedAlbumTrackKey.get(trackKey)
        if (currentTrackWords) {
          currentTrackWords.words += wordsWritten
        } else {
          wordsBySavedAlbumTrackKey.set(trackKey, {
            savedAlbumId: section.user_saved_album_id,
            trackNumber: section.track_number,
            words: wordsWritten,
          })
        }
      }
    }

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

  for (const [savedAlbumId, score] of conclusionScoreBySavedAlbumId.entries()) {
    const album = savedAlbumById.get(savedAlbumId)
    if (!album) {
      continue
    }
    const existing = artistScoreAccumulator.get(album.artistName)
    if (existing) {
      existing.totalScore += score
      existing.albumCount += 1
    } else {
      artistScoreAccumulator.set(album.artistName, { totalScore: score, albumCount: 1 })
    }
  }

  const topArtistsByScore = Array.from(artistScoreAccumulator.entries())
    .map(([artistName, { totalScore, albumCount }]): RankedArtistStat => ({
      artistName,
      value: totalScore / albumCount,
      albumCount,
    }))
    .sort((left, right) => {
      if (right.value !== left.value) {
        return right.value - left.value
      }
      return left.artistName.localeCompare(right.artistName)
    })
    .slice(0, 10)

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

  const topAlbumsByWordsWritten = Array.from(wordsBySavedAlbumId.entries())
    .flatMap(([savedAlbumId, wordCount]) => {
      const album = savedAlbumById.get(savedAlbumId)
      if (!album) {
        return []
      }

      return [toRankedAlbumStat(album, wordCount)]
    })
    .sort(sortByValueDescending)
    .slice(0, 10)

  const topSongsByWordsWritten = Array.from(wordsBySavedAlbumTrackKey.values())
    .flatMap(({ savedAlbumId, trackNumber, words }) => {
      const album = savedAlbumById.get(savedAlbumId)
      if (!album) {
        return []
      }

      const trackTitle = trackTitleByAlbumAndNumber.get(toTrackKey(album.albumId, trackNumber)) ?? `Track ${trackNumber}`
      return [toRankedSongStat(album, trackNumber, trackTitle, words)]
    })
    .sort(sortSongsByValueDescending)
    .slice(0, 10)

  const grandTotalWordsWritten = Array.from(wordsBySavedAlbumId.values()).reduce(
    (total, words) => total + words,
    0,
  )

  const favoriteWords = Array.from(wordFrequency.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count
      }

      return left.word.localeCompare(right.word)
    })
    .slice(0, 3)

  return {
    topAlbumsByConclusionScore,
    topAlbumsByTrackAverage,
    topSongsByScore,
    topInterludeSongs,
    topAlbumsByWordsWritten,
    topSongsByWordsWritten,
    grandTotalWordsWritten,
    favoriteWords,
    topArtistsByScore,
  }
}

export const getMyStatsForCurrentUser = async (): Promise<MyStatsData> => {
  const savedAlbums = await listSavedAlbumsForCurrentUser()
  return buildStatsFromSavedAlbums(savedAlbums)
}

export const getStatsForUser = async (userId: string): Promise<MyStatsData> => {
  const savedAlbums = await listSavedAlbumsForUser(userId)
  return buildStatsFromSavedAlbums(savedAlbums)
}
