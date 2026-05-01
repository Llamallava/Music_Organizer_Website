import type { SaveAlbumTrackInput } from '../db/reviewsData'
import { getLyricsAsync } from './geniusLyrics'
import { getAlbumCoverUrls } from './spotifyAlbumCovers'

export type AlbumSearchResult = {
  sourceProvider: 'musicbrainz'
  sourceAlbumId: string
  title: string
  artistName: string
  artistNames: string[]
  coverUrl: string | null
  hasCover: boolean
  releaseDate: string | null
  totalTracks: number
}

export type AlbumSearchInput = {
  artistName: string
  albumTitle: string
}

export type SongSearchInput = {
  artistName: string
  songTitle: string
}

export type SongSearchResult = {
  sourceProvider: 'musicbrainz'
  sourceSongId: string
  songName: string
  artistName: string
  albumTitle: string | null
  coverUrl: string | null
  releaseDate: string | null
}

type MusicBrainzArtistCredit = {
  name?: string
  joinphrase?: string
  artist?: {
    name?: string
  }
}

type MusicBrainzMediaSummary = {
  'track-count'?: number
}

type MusicBrainzReleaseSearchResult = {
  id: string
  title?: string
  date?: string
  'release-group'?: {
    id?: string
  }
  'artist-credit'?: MusicBrainzArtistCredit[]
  media?: MusicBrainzMediaSummary[]
}

type MusicBrainzSearchResponse = {
  releases?: MusicBrainzReleaseSearchResult[]
}

type MusicBrainzRecordingRelease = {
  id?: string
  title?: string
  date?: string
}

type MusicBrainzRecordingSearchResult = {
  id: string
  title?: string
  'artist-credit'?: MusicBrainzArtistCredit[]
  releases?: MusicBrainzRecordingRelease[]
}

type MusicBrainzRecordingSearchResponse = {
  recordings?: MusicBrainzRecordingSearchResult[]
}

type MusicBrainzTrack = {
  title?: string
  length?: number
}

type MusicBrainzReleaseLookupMedia = {
  position?: number
  tracks?: MusicBrainzTrack[]
}

type MusicBrainzReleaseLookupResponse = {
  media?: MusicBrainzReleaseLookupMedia[]
}

const MUSICBRAINZ_BASE = 'https://musicbrainz.org/ws/2'

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`)
  }

  return (await response.json()) as T
}

const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const includesNormalized = (haystack: string, needle: string): boolean => {
  const normalizedNeedle = normalize(needle)
  if (!normalizedNeedle) {
    return true
  }

  return normalize(haystack).includes(normalizedNeedle)
}

const toSqlDate = (partialDate: string | undefined): string | null => {
  if (!partialDate) {
    return null
  }

  const normalized = partialDate.trim()
  if (!normalized) {
    return null
  }

  if (/^\d{4}$/.test(normalized)) {
    return `${normalized}-01-01`
  }

  if (/^\d{4}-\d{2}$/.test(normalized)) {
    return `${normalized}-01`
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized
  }

  return null
}

const escapeLuceneValue = (value: string): string => value.replace(/["\\]/g, '\\$&')

const getArtistNameFromCredit = (credit: MusicBrainzArtistCredit[] | undefined): string => {
  if (!credit || credit.length === 0) {
    return 'Unknown Artist'
  }

  const joined = credit
    .map((entry) => (entry.name ?? entry.artist?.name ?? '') + (entry.joinphrase ?? ''))
    .join('')
    .trim()

  return joined || 'Unknown Artist'
}

const getIndividualArtistNamesFromCredit = (credit: MusicBrainzArtistCredit[] | undefined): string[] => {
  if (!credit || credit.length === 0) {
    return []
  }

  return credit
    .map((entry) => (entry.name ?? entry.artist?.name ?? '').trim())
    .filter(Boolean)
}

const getTrackCount = (media: MusicBrainzMediaSummary[] | undefined): number => {
  if (!media || media.length === 0) {
    return 0
  }

  return media.reduce((total, medium) => total + (medium['track-count'] ?? 0), 0)
}

const scoreAlbumResult = (
  result: AlbumSearchResult,
  artistNameFilter: string,
  albumTitleFilter: string,
): number => {
  let score = 0

  const normalizedArtist = normalize(result.artistName)
  const normalizedTitle = normalize(result.title)
  const normalizedArtistFilter = normalize(artistNameFilter)
  const normalizedTitleFilter = normalize(albumTitleFilter)

  if (normalizedArtistFilter) {
    if (normalizedArtist === normalizedArtistFilter) {
      score += 4
    } else if (normalizedArtist.includes(normalizedArtistFilter)) {
      score += 2
    }
  }

  if (normalizedTitleFilter) {
    if (normalizedTitle === normalizedTitleFilter) {
      score += 5
    } else if (normalizedTitle.includes(normalizedTitleFilter)) {
      score += 3
    }
  }

  return score
}

const scoreSongResult = (
  result: SongSearchResult,
  artistNameFilter: string,
  songTitleFilter: string,
): number => {
  let score = 0

  const normalizedArtist = normalize(result.artistName)
  const normalizedSong = normalize(result.songName)
  const normalizedArtistFilter = normalize(artistNameFilter)
  const normalizedSongFilter = normalize(songTitleFilter)

  if (normalizedArtistFilter) {
    if (normalizedArtist === normalizedArtistFilter) {
      score += 4
    } else if (normalizedArtist.includes(normalizedArtistFilter)) {
      score += 2
    }
  }

  if (normalizedSongFilter) {
    if (normalizedSong === normalizedSongFilter) {
      score += 5
    } else if (normalizedSong.includes(normalizedSongFilter)) {
      score += 3
    }
  }

  return score
}

type AlbumSearchCandidate = AlbumSearchResult & {
  dedupeKey: string
}

const getAlbumDedupeKey = ({
  releaseGroupId,
  artistName,
  title,
}: {
  releaseGroupId?: string
  artistName: string
  title: string
}): string => {
  const normalizedReleaseGroupId = releaseGroupId?.trim()
  if (normalizedReleaseGroupId) {
    return `release-group:${normalizedReleaseGroupId}`
  }

  return `artist-title:${normalize(artistName)}::${normalize(title)}`
}

const dedupeAlbumResults = (results: AlbumSearchCandidate[]): AlbumSearchCandidate[] => {
  const seenKeys = new Set<string>()

  return results.filter((result) => {
    if (seenKeys.has(result.dedupeKey)) {
      return false
    }

    seenKeys.add(result.dedupeKey)
    return true
  })
}

const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = new Array(items.length)
  let cursor = 0

  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index], index)
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}


export const searchAlbums = async (input: AlbumSearchInput): Promise<AlbumSearchResult[]> => {
  const artistName = input.artistName.trim()
  const albumTitle = input.albumTitle.trim()

  if (!artistName && !albumTitle) {
    return []
  }

  const queryParts: string[] = []
  if (albumTitle) {
    const escapedTitle = escapeLuceneValue(albumTitle)
    queryParts.push(`(release:"${escapedTitle}" OR recording:"${escapedTitle}")`)
  }
  if (artistName) {
    queryParts.push(`artist:"${escapeLuceneValue(artistName)}"`)
  }

  const query = queryParts.join(' AND ')
  const url = `${MUSICBRAINZ_BASE}/release?query=${encodeURIComponent(query)}&fmt=json&limit=60`
  const data = await fetchJson<MusicBrainzSearchResponse>(url)
  const releases = data.releases ?? []

  const mappedResults: AlbumSearchCandidate[] = releases.map((release) => {
    const title = release.title?.trim() || 'Unknown Album'
    const credit = release['artist-credit']
    const artistName = getArtistNameFromCredit(credit)
    const artistNames = getIndividualArtistNamesFromCredit(credit)

    return {
      hasCover: false,
      sourceProvider: 'musicbrainz' as const,
      sourceAlbumId: release.id,
      title,
      artistName,
      artistNames: artistNames.length > 0 ? artistNames : [artistName],
      coverUrl: null,
      releaseDate: toSqlDate(release.date),
      totalTracks: getTrackCount(release.media),
      dedupeKey: getAlbumDedupeKey({
        releaseGroupId: release['release-group']?.id,
        artistName,
        title,
      }),
    }
  })

  const filteredResults = mappedResults.filter((result) => {
    return includesNormalized(result.artistName, artistName) && includesNormalized(result.title, albumTitle)
  })

  const prioritized = (filteredResults.length > 0 ? filteredResults : mappedResults).sort((a, b) => {
    const scoreA = scoreAlbumResult(a, artistName, albumTitle)
    const scoreB = scoreAlbumResult(b, artistName, albumTitle)
    return scoreB - scoreA
  })

  const deduped = dedupeAlbumResults(prioritized)
  const limited = deduped.slice(0, 25)

  const coverUrls = await getAlbumCoverUrls(
    limited.map((r) => ({ artistName: r.artistName, albumTitle: r.title })),
  )

  const withCovers = limited.map((result, i) => ({
    ...result,
    coverUrl: coverUrls[i] ?? null,
    hasCover: coverUrls[i] != null,
  }))

  const withCover = withCovers.filter((result) => result.hasCover)
  const withoutCover = withCovers.filter((result) => !result.hasCover)

  return [...withCover, ...withoutCover].map(({ dedupeKey: _dedupeKey, ...result }) => result)
}

export const searchSongs = async (input: SongSearchInput): Promise<SongSearchResult[]> => {
  const artistName = input.artistName.trim()
  const songTitle = input.songTitle.trim()

  if (!artistName && !songTitle) {
    return []
  }

  const queryParts: string[] = []
  if (songTitle) {
    queryParts.push(`recording:"${escapeLuceneValue(songTitle)}"`)
  }
  if (artistName) {
    queryParts.push(`artist:"${escapeLuceneValue(artistName)}"`)
  }

  const query = queryParts.join(' AND ')
  const url = `${MUSICBRAINZ_BASE}/recording?query=${encodeURIComponent(query)}&fmt=json&limit=60`
  const data = await fetchJson<MusicBrainzRecordingSearchResponse>(url)
  const recordings = data.recordings ?? []

  const mappedResults: SongSearchResult[] = recordings.map((recording) => {
    const release = recording.releases?.[0]

    return {
      sourceProvider: 'musicbrainz',
      sourceSongId: recording.id,
      songName: recording.title?.trim() || 'Unknown Song',
      artistName: getArtistNameFromCredit(recording['artist-credit']),
      albumTitle: release?.title?.trim() || null,
      coverUrl: null,
      releaseDate: toSqlDate(release?.date),
    }
  })

  const filteredResults = mappedResults.filter((result) => {
    return (
      includesNormalized(result.artistName, artistName) &&
      includesNormalized(result.songName, songTitle)
    )
  })

  const prioritized = (filteredResults.length > 0 ? filteredResults : mappedResults).sort((a, b) => {
    const scoreA = scoreSongResult(a, artistName, songTitle)
    const scoreB = scoreSongResult(b, artistName, songTitle)
    return scoreB - scoreA
  })

  const seen = new Set<string>()
  const deduped: SongSearchResult[] = []

  for (const result of prioritized) {
    const key = `${result.sourceSongId}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    deduped.push(result)
  }

  const limited = deduped.slice(0, 40)

  const coverUrls = await getAlbumCoverUrls(
    limited.map((r) => ({ artistName: r.artistName, albumTitle: r.albumTitle ?? '' })),
  )

  return limited.map((result, i) => ({
    ...result,
    coverUrl: coverUrls[i] ?? null,
  }))
}

export const fetchAlbumTracksWithLyrics = async (
  sourceAlbumId: string,
  artistName: string,
  artistNames: string[] = [],
): Promise<SaveAlbumTrackInput[]> => {
  const url = `${MUSICBRAINZ_BASE}/release/${encodeURIComponent(sourceAlbumId)}?fmt=json&inc=recordings`
  const data = await fetchJson<MusicBrainzReleaseLookupResponse>(url)
  const media = data.media ?? []

  const orderedMedia = [...media].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const flattenedTracks: Array<{ trackNumber: number; title: string; durationSeconds: number | null }> = []
  let runningTrackNumber = 1

  for (const medium of orderedMedia) {
    const tracks = medium.tracks ?? []

    for (const track of tracks) {
      const title = track.title?.trim() || 'Unknown Track'
      const durationSeconds = track.length && track.length > 0 ? Math.round(track.length / 1000) : null

      flattenedTracks.push({
        trackNumber: runningTrackNumber,
        title,
        durationSeconds,
      })

      runningTrackNumber += 1
    }
  }

  const primaryArtistName = artistNames[0] ?? artistName

  const tracksWithLyrics = await mapWithConcurrency(flattenedTracks, 4, async (track) => {
    const lyrics = await getLyricsAsync(track.title, primaryArtistName)
    return {
      trackNumber: track.trackNumber,
      title: track.title,
      durationSeconds: track.durationSeconds,
      lyrics,
      metadata: {},
    }
  })

  if (import.meta.env.DEV) {
    const missingLyricsTracks = tracksWithLyrics.filter((track) => !track.lyrics.trim())
    if (missingLyricsTracks.length > 0) {
      const sampleTitles = missingLyricsTracks
        .slice(0, 5)
        .map((track) => `"${track.title}"`)
        .join(', ')

      console.warn(
        `Lyrics missing for ${missingLyricsTracks.length}/${tracksWithLyrics.length} tracks (${sampleTitles}).`,
      )
    }
  }

  return tracksWithLyrics
}
