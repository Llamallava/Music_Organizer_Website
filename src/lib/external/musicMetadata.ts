import type { SaveAlbumTrackInput } from '../db/reviewsData'

export type AlbumSearchResult = {
  sourceProvider: 'itunes'
  sourceAlbumId: string
  title: string
  artistName: string
  coverUrl: string | null
  releaseDate: string | null
  totalTracks: number
}

type ITunesAlbumResult = {
  wrapperType: string
  collectionType?: string
  collectionId: number
  collectionName: string
  artistName: string
  artworkUrl100?: string
  releaseDate?: string
  trackCount?: number
}

type ITunesTrackResult = {
  wrapperType: string
  kind?: string
  trackNumber?: number
  trackName?: string
  trackTimeMillis?: number
}

const toHighResArtwork = (url: string | undefined): string | null => {
  if (!url) {
    return null
  }

  return url.replace(/\/[0-9]+x[0-9]+bb\./, '/600x600bb.')
}

const toSqlDate = (isoDate: string | undefined): string | null => {
  if (!isoDate) {
    return null
  }

  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString().slice(0, 10)
}

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`)
  }

  return (await response.json()) as T
}

export const searchAlbums = async (query: string): Promise<AlbumSearchResult[]> => {
  const trimmed = query.trim()
  if (!trimmed) {
    return []
  }

  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(trimmed)}&entity=album&limit=25`
  const data = await fetchJson<{ results?: ITunesAlbumResult[] }>(url)
  const results = data.results ?? []

  return results
    .filter((result) => result.wrapperType === 'collection' && result.collectionType === 'Album')
    .map((result) => ({
      sourceProvider: 'itunes' as const,
      sourceAlbumId: String(result.collectionId),
      title: result.collectionName,
      artistName: result.artistName,
      coverUrl: toHighResArtwork(result.artworkUrl100),
      releaseDate: toSqlDate(result.releaseDate),
      totalTracks: result.trackCount ?? 0,
    }))
}

const fetchTrackLyrics = async (artistName: string, trackName: string): Promise<string> => {
  const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artistName)}/${encodeURIComponent(trackName)}`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      return ''
    }

    const data = (await response.json()) as { lyrics?: string }
    const lyrics = data.lyrics?.trim() ?? ''
    return lyrics
  } catch {
    return ''
  }
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

export const fetchAlbumTracksWithLyrics = async (
  sourceAlbumId: string,
  artistName: string,
): Promise<SaveAlbumTrackInput[]> => {
  const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(sourceAlbumId)}&entity=song`
  const data = await fetchJson<{ results?: ITunesTrackResult[] }>(url)
  const results = data.results ?? []

  const tracks = results
    .filter((result) => result.wrapperType === 'track' && result.kind === 'song')
    .map((result) => ({
      trackNumber: result.trackNumber ?? 0,
      title: result.trackName ?? 'Unknown Track',
      durationSeconds:
        result.trackTimeMillis && result.trackTimeMillis > 0
          ? Math.round(result.trackTimeMillis / 1000)
          : null,
    }))
    .filter((track) => track.trackNumber > 0)
    .sort((a, b) => a.trackNumber - b.trackNumber)

  return mapWithConcurrency(tracks, 4, async (track) => {
    const lyrics = await fetchTrackLyrics(artistName, track.title)
    return {
      trackNumber: track.trackNumber,
      title: track.title,
      durationSeconds: track.durationSeconds,
      lyrics,
      metadata: {},
    }
  })
}
