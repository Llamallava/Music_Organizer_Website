import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AlbumCover from '../components/AlbumCover'
import { listSearchSongsForCurrentUser, type SearchSongRecord } from '../lib/db/searchData'

type ScoreMinOperator = 'gte' | 'gt'
type ScoreMaxOperator = 'lte' | 'lt'
type ScoreMode = 'any' | 'scored' | 'unscored'
type InterludeMode = 'any' | 'only' | 'exclude'
type SortOrder = 'artist' | 'score-desc' | 'score-asc' | 'recent'

const formatScore = (score: number | null) => {
  if (score === null) {
    return 'Unscored'
  }

  return score.toFixed(1).replace(/\.0$/, '')
}

const includesCaseInsensitive = (source: string, query: string) => {
  if (!query) {
    return true
  }

  return source.toLocaleLowerCase().includes(query)
}

const parseOptionalNumber = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return { value: null, error: null as string | null }
  }

  const parsed = Number(trimmed)
  if (Number.isNaN(parsed)) {
    return { value: null, error: 'Score filters must be valid numbers.' }
  }

  return { value: parsed, error: null as string | null }
}

const scorePassesMinFilter = (score: number, minScore: number, operator: ScoreMinOperator) => {
  if (operator === 'gt') {
    return score > minScore
  }

  return score >= minScore
}

const scorePassesMaxFilter = (score: number, maxScore: number, operator: ScoreMaxOperator) => {
  if (operator === 'lt') {
    return score < maxScore
  }

  return score <= maxScore
}

const scoreBoundsConflict = (
  minScore: number | null,
  minOperator: ScoreMinOperator,
  maxScore: number | null,
  maxOperator: ScoreMaxOperator,
) => {
  if (minScore === null || maxScore === null) {
    return false
  }

  if (minScore > maxScore) {
    return true
  }

  if (minScore < maxScore) {
    return false
  }

  return minOperator === 'gt' || maxOperator === 'lt'
}

const buildLyricsSnippet = (lyrics: string, query: string) => {
  const normalizedLyrics = lyrics.trim()
  if (!normalizedLyrics) {
    return 'No lyrics stored.'
  }

  const maxLength = 170
  if (!query) {
    if (normalizedLyrics.length <= maxLength) {
      return normalizedLyrics
    }

    return `${normalizedLyrics.slice(0, maxLength)}...`
  }

  const lowerLyrics = normalizedLyrics.toLocaleLowerCase()
  const hitIndex = lowerLyrics.indexOf(query)

  if (hitIndex < 0) {
    if (normalizedLyrics.length <= maxLength) {
      return normalizedLyrics
    }

    return `${normalizedLyrics.slice(0, maxLength)}...`
  }

  const contextRadius = 70
  const start = Math.max(0, hitIndex - contextRadius)
  const end = Math.min(normalizedLyrics.length, hitIndex + query.length + contextRadius)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < normalizedLyrics.length ? '...' : ''
  return `${prefix}${normalizedLyrics.slice(start, end)}${suffix}`
}

function SearchPage() {
  const navigate = useNavigate()
  const [songs, setSongs] = useState<SearchSongRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [artistQuery, setArtistQuery] = useState('')
  const [albumQuery, setAlbumQuery] = useState('')
  const [trackQuery, setTrackQuery] = useState('')
  const [lyricsQuery, setLyricsQuery] = useState('')
  const [notesQuery, setNotesQuery] = useState('')
  const [scoreMode, setScoreMode] = useState<ScoreMode>('any')
  const [interludeMode, setInterludeMode] = useState<InterludeMode>('any')
  const [minScoreInput, setMinScoreInput] = useState('')
  const [minScoreOperator, setMinScoreOperator] = useState<ScoreMinOperator>('gte')
  const [maxScoreInput, setMaxScoreInput] = useState('')
  const [maxScoreOperator, setMaxScoreOperator] = useState<ScoreMaxOperator>('lte')
  const [sortOrder, setSortOrder] = useState<SortOrder>('artist')

  useEffect(() => {
    let isActive = true

    const loadSongs = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const records = await listSearchSongsForCurrentUser()

        if (!isActive) {
          return
        }

        setSongs(records)
      } catch (error) {
        if (!isActive) {
          return
        }

        const message = error instanceof Error ? error.message : 'Failed to load songs for search.'
        setErrorMessage(message)
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadSongs()

    return () => {
      isActive = false
    }
  }, [])

  const normalizedArtistQuery = artistQuery.trim().toLocaleLowerCase()
  const normalizedAlbumQuery = albumQuery.trim().toLocaleLowerCase()
  const normalizedTrackQuery = trackQuery.trim().toLocaleLowerCase()
  const normalizedLyricsQuery = lyricsQuery.trim().toLocaleLowerCase()
  const normalizedNotesQuery = notesQuery.trim().toLocaleLowerCase()
  const parsedMinScore = parseOptionalNumber(minScoreInput)
  const parsedMaxScore = parseOptionalNumber(maxScoreInput)

  const validationMessage = useMemo(() => {
    if (parsedMinScore.error) {
      return parsedMinScore.error
    }

    if (parsedMaxScore.error) {
      return parsedMaxScore.error
    }

    if (
      scoreBoundsConflict(
        parsedMinScore.value,
        minScoreOperator,
        parsedMaxScore.value,
        maxScoreOperator,
      )
    ) {
      return 'Min and max score filters conflict. Update bounds or operators.'
    }

    return null
  }, [maxScoreOperator, minScoreOperator, parsedMaxScore, parsedMinScore])

  const filteredSongs = useMemo(() => {
    if (validationMessage) {
      return []
    }

    const minScore = parsedMinScore.value
    const maxScore = parsedMaxScore.value

    const filtered = songs.filter((song) => {
      if (!includesCaseInsensitive(song.artistName, normalizedArtistQuery)) {
        return false
      }

      if (!includesCaseInsensitive(song.albumTitle, normalizedAlbumQuery)) {
        return false
      }

      if (!includesCaseInsensitive(song.trackTitle, normalizedTrackQuery)) {
        return false
      }

      if (!includesCaseInsensitive(song.lyrics, normalizedLyricsQuery)) {
        return false
      }

      if (!includesCaseInsensitive(song.reviewNotes, normalizedNotesQuery)) {
        return false
      }

      if (scoreMode === 'scored' && song.score === null) {
        return false
      }

      if (scoreMode === 'unscored' && song.score !== null) {
        return false
      }

      if (interludeMode === 'only' && !song.isInterlude) {
        return false
      }

      if (interludeMode === 'exclude' && song.isInterlude) {
        return false
      }

      if (minScore !== null || maxScore !== null) {
        if (song.score === null) {
          return false
        }

        if (minScore !== null && !scorePassesMinFilter(song.score, minScore, minScoreOperator)) {
          return false
        }

        if (maxScore !== null && !scorePassesMaxFilter(song.score, maxScore, maxScoreOperator)) {
          return false
        }
      }

      return true
    })

    if (sortOrder === 'score-desc') {
      filtered.sort((left, right) => {
        if (left.score === null && right.score === null) {
          return left.trackTitle.localeCompare(right.trackTitle)
        }

        if (left.score === null) {
          return 1
        }

        if (right.score === null) {
          return -1
        }

        if (right.score !== left.score) {
          return right.score - left.score
        }

        return left.trackTitle.localeCompare(right.trackTitle)
      })

      return filtered
    }

    if (sortOrder === 'score-asc') {
      filtered.sort((left, right) => {
        if (left.score === null && right.score === null) {
          return left.trackTitle.localeCompare(right.trackTitle)
        }

        if (left.score === null) {
          return 1
        }

        if (right.score === null) {
          return -1
        }

        if (left.score !== right.score) {
          return left.score - right.score
        }

        return left.trackTitle.localeCompare(right.trackTitle)
      })

      return filtered
    }

    if (sortOrder === 'recent') {
      filtered.sort((left, right) => {
        if (right.savedAt !== left.savedAt) {
          return right.savedAt.localeCompare(left.savedAt)
        }

        return left.trackTitle.localeCompare(right.trackTitle)
      })

      return filtered
    }

    filtered.sort((left, right) => {
      if (left.artistName !== right.artistName) {
        return left.artistName.localeCompare(right.artistName)
      }

      if (left.albumTitle !== right.albumTitle) {
        return left.albumTitle.localeCompare(right.albumTitle)
      }

      return left.trackNumber - right.trackNumber
    })

    return filtered
  }, [
    interludeMode,
    maxScoreOperator,
    minScoreOperator,
    normalizedAlbumQuery,
    normalizedArtistQuery,
    normalizedLyricsQuery,
    normalizedNotesQuery,
    normalizedTrackQuery,
    parsedMaxScore.value,
    parsedMinScore.value,
    scoreMode,
    songs,
    sortOrder,
    validationMessage,
  ])

  const clearFilters = () => {
    setArtistQuery('')
    setAlbumQuery('')
    setTrackQuery('')
    setLyricsQuery('')
    setNotesQuery('')
    setScoreMode('any')
    setInterludeMode('any')
    setMinScoreInput('')
    setMinScoreOperator('gte')
    setMaxScoreInput('')
    setMaxScoreOperator('lte')
    setSortOrder('artist')
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Back Home
          </button>

          <button
            type="button"
            onClick={() => navigate('/reviews')}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Go to Reviews
          </button>
        </div>

        <h1 className="mt-5 text-3xl font-black text-slate-900">Search Songs</h1>
        <p className="mt-2 text-sm text-slate-700">
          Combine filters to answer questions like lyrics keyword matches or artist + score ranges.
        </p>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="text-sm text-slate-700">
              Artist contains
              <input
                type="text"
                value={artistQuery}
                onChange={(event) => setArtistQuery(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm text-slate-700">
              Album contains
              <input
                type="text"
                value={albumQuery}
                onChange={(event) => setAlbumQuery(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm text-slate-700">
              Song contains
              <input
                type="text"
                value={trackQuery}
                onChange={(event) => setTrackQuery(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm text-slate-700">
              Lyrics contain
              <input
                type="text"
                value={lyricsQuery}
                onChange={(event) => setLyricsQuery(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm text-slate-700">
              Notes contain
              <input
                type="text"
                value={notesQuery}
                onChange={(event) => setNotesQuery(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="text-sm text-slate-700">
              Score mode
              <select
                value={scoreMode}
                onChange={(event) => setScoreMode(event.target.value as ScoreMode)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="any">Any</option>
                <option value="scored">Scored only</option>
                <option value="unscored">Unscored only</option>
              </select>
            </label>

            <label className="text-sm text-slate-700">
              Interludes
              <select
                value={interludeMode}
                onChange={(event) => setInterludeMode(event.target.value as InterludeMode)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="any">Any</option>
                <option value="only">Interludes only</option>
                <option value="exclude">Exclude interludes</option>
              </select>
            </label>

            <label className="text-sm text-slate-700">
              Min score
              <div className="mt-1 flex gap-2">
                <select
                  value={minScoreOperator}
                  onChange={(event) => setMinScoreOperator(event.target.value as ScoreMinOperator)}
                  className="w-20 rounded-md border border-slate-300 px-2 py-2 text-sm"
                >
                  <option value="gte">&gt;=</option>
                  <option value="gt">&gt;</option>
                </select>
                <input
                  type="text"
                  value={minScoreInput}
                  onChange={(event) => setMinScoreInput(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </label>

            <label className="text-sm text-slate-700">
              Max score
              <div className="mt-1 flex gap-2">
                <select
                  value={maxScoreOperator}
                  onChange={(event) => setMaxScoreOperator(event.target.value as ScoreMaxOperator)}
                  className="w-20 rounded-md border border-slate-300 px-2 py-2 text-sm"
                >
                  <option value="lte">&lt;=</option>
                  <option value="lt">&lt;</option>
                </select>
                <input
                  type="text"
                  value={maxScoreInput}
                  onChange={(event) => setMaxScoreInput(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </label>

            <label className="text-sm text-slate-700">
              Sort
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as SortOrder)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="artist">Artist / Album / Track</option>
                <option value="score-desc">Score high to low</option>
                <option value="score-asc">Score low to high</option>
                <option value="recent">Recently added albums</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
            <p className="text-sm text-slate-700">
              Results: <span className="font-semibold text-slate-900">{filteredSongs.length}</span>
            </p>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900"
            >
              Clear Filters
            </button>
          </div>

          {validationMessage && (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {validationMessage}
            </div>
          )}
        </section>

        {isLoading && <p className="mt-6 rounded-lg bg-white p-4 text-sm text-slate-700">Loading songs...</p>}

        {!isLoading && errorMessage && (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <p>Could not load searchable songs.</p>
            <p className="mt-1">{errorMessage}</p>
          </div>
        )}

        {!isLoading && !errorMessage && songs.length === 0 && (
          <p className="mt-6 rounded-lg bg-white p-4 text-sm text-slate-700">
            No songs found yet. Add and review albums to start searching.
          </p>
        )}

        {!isLoading && !errorMessage && songs.length > 0 && filteredSongs.length === 0 && !validationMessage && (
          <p className="mt-6 rounded-lg bg-white p-4 text-sm text-slate-700">
            No songs matched the current filters.
          </p>
        )}

        {!isLoading && !errorMessage && filteredSongs.length > 0 && (
          <section className="mt-6 space-y-3">
            {filteredSongs.map((song) => (
              <article
                key={`${song.userSavedAlbumId}:${song.trackNumber}`}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-200">
                    <AlbumCover src={song.coverUrl} alt={`${song.albumTitle} cover`} loading="lazy" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold text-slate-900">
                      {song.trackNumber}. {song.trackTitle}
                    </p>
                    <p className="text-sm font-semibold text-slate-700">{song.artistName}</p>
                    <p className="text-sm text-slate-600">{song.albumTitle}</p>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                        Score: {formatScore(song.score)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                        {song.isInterlude ? 'Interlude' : 'Track'}
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-slate-700">
                      {buildLyricsSnippet(song.lyrics, normalizedLyricsQuery)}
                    </p>

                    {song.reviewNotes.trim() && (
                      <p className="mt-2 text-sm text-slate-600">
                        <span className="font-semibold text-slate-700">Notes:</span> {song.reviewNotes}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/reviews/${song.userSavedAlbumId}`)}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                  >
                    Open Review
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}

export default SearchPage
