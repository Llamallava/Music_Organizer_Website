import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AlbumCover from '../components/AlbumCover'
import LinearBackButton from '../components/LinearBackButton'
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
  const [tagQuery, setTagQuery] = useState('')
  const [scoreMode, setScoreMode] = useState<ScoreMode>('any')
  const [interludeMode, setInterludeMode] = useState<InterludeMode>('any')
  const [minScoreInput, setMinScoreInput] = useState('')
  const [minScoreOperator, setMinScoreOperator] = useState<ScoreMinOperator>('gte')
  const [maxScoreInput, setMaxScoreInput] = useState('')
  const [maxScoreOperator, setMaxScoreOperator] = useState<ScoreMaxOperator>('lte')
  const [sortOrder, setSortOrder] = useState<SortOrder>('artist')
  const [hasSearched, setHasSearched] = useState(false)

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
  const normalizedTagQuery = tagQuery.trim().toLocaleLowerCase()
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

      if (normalizedTagQuery && !song.tags.some((tag) => tag.includes(normalizedTagQuery))) {
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
    normalizedTagQuery,
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
    setTagQuery('')
    setScoreMode('any')
    setInterludeMode('any')
    setMinScoreInput('')
    setMinScoreOperator('gte')
    setMaxScoreInput('')
    setMaxScoreOperator('lte')
    setSortOrder('artist')
    setHasSearched(false)
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <LinearBackButton />

        </div>

        <h1 className="mt-5 text-3xl font-black text-ink">Search Songs</h1>
        <p className="mt-2 text-sm text-ink">
          Combine filters to answer questions like lyrics keyword matches or artist + score ranges.
        </p>

        <section className="mt-6 rounded-xl border border-edge bg-surface p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="text-sm text-ink">
              Artist contains
              <input
                type="text"
                value={artistQuery}
                onChange={(event) => setArtistQuery(event.target.value)}
                className="mt-1 w-full rounded-md border border-edge px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm text-ink">
              Album contains
              <input
                type="text"
                value={albumQuery}
                onChange={(event) => setAlbumQuery(event.target.value)}
                className="mt-1 w-full rounded-md border border-edge px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm text-ink">
              Song contains
              <input
                type="text"
                value={trackQuery}
                onChange={(event) => setTrackQuery(event.target.value)}
                className="mt-1 w-full rounded-md border border-edge px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm text-ink">
              Lyrics contain
              <input
                type="text"
                value={lyricsQuery}
                onChange={(event) => setLyricsQuery(event.target.value)}
                className="mt-1 w-full rounded-md border border-edge px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm text-ink">
              Notes contain
              <input
                type="text"
                value={notesQuery}
                onChange={(event) => setNotesQuery(event.target.value)}
                className="mt-1 w-full rounded-md border border-edge px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm text-slate-700">
              Tag contains
              <input
                type="text"
                value={tagQuery}
                onChange={(event) => setTagQuery(event.target.value)}
                placeholder="e.g. rainy day"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="text-sm text-ink">
              Score mode
              <select
                value={scoreMode}
                onChange={(event) => setScoreMode(event.target.value as ScoreMode)}
                className="mt-1 w-full rounded-md border border-edge px-3 py-2 text-sm"
              >
                <option value="any">Any</option>
                <option value="scored">Scored only</option>
                <option value="unscored">Unscored only</option>
              </select>
            </label>

            <label className="text-sm text-ink">
              Interludes
              <select
                value={interludeMode}
                onChange={(event) => setInterludeMode(event.target.value as InterludeMode)}
                className="mt-1 w-full rounded-md border border-edge px-3 py-2 text-sm"
              >
                <option value="any">Any</option>
                <option value="only">Interludes only</option>
                <option value="exclude">Exclude interludes</option>
              </select>
            </label>

            <label className="text-sm text-ink">
              Min score
              <div className="mt-1 flex gap-2">
                <select
                  value={minScoreOperator}
                  onChange={(event) => setMinScoreOperator(event.target.value as ScoreMinOperator)}
                  className="w-20 rounded-md border border-edge px-2 py-2 text-sm"
                >
                  <option value="gte">&gt;=</option>
                  <option value="gt">&gt;</option>
                </select>
                <input
                  type="text"
                  value={minScoreInput}
                  onChange={(event) => setMinScoreInput(event.target.value)}
                  className="w-full rounded-md border border-edge px-3 py-2 text-sm"
                />
              </div>
            </label>

            <label className="text-sm text-ink">
              Max score
              <div className="mt-1 flex gap-2">
                <select
                  value={maxScoreOperator}
                  onChange={(event) => setMaxScoreOperator(event.target.value as ScoreMaxOperator)}
                  className="w-20 rounded-md border border-edge px-2 py-2 text-sm"
                >
                  <option value="lte">&lt;=</option>
                  <option value="lt">&lt;</option>
                </select>
                <input
                  type="text"
                  value={maxScoreInput}
                  onChange={(event) => setMaxScoreInput(event.target.value)}
                  className="w-full rounded-md border border-edge px-3 py-2 text-sm"
                />
              </div>
            </label>

            <label className="text-sm text-ink">
              Sort
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as SortOrder)}
                className="mt-1 w-full rounded-md border border-edge px-3 py-2 text-sm"
              >
                <option value="artist">Artist / Album / Track</option>
                <option value="score-desc">Score high to low</option>
                <option value="score-asc">Score low to high</option>
                <option value="recent">Recently added albums</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-edge pt-3">
            {hasSearched ? (
              <p className="text-sm text-ink">
                Results: <span className="font-semibold text-ink">{filteredSongs.length}</span>
              </p>
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-semibold text-ink hover:bg-surface-3"
              >
                Clear Filters
              </button>
              <button
                type="button"
                onClick={() => setHasSearched(true)}
                className="rounded-lg bg-cta px-3 py-2 text-sm font-semibold text-white"
              >
                Search
              </button>
            </div>
          </div>

          {validationMessage && (
            <div className="mt-3 rounded-lg border border-err-edge bg-err-bg p-3 text-sm text-err">
              {validationMessage}
            </div>
          )}
        </section>

        {hasSearched && isLoading && <p className="mt-6 rounded-lg bg-surface p-4 text-sm text-ink">Loading songs...</p>}

        {hasSearched && !isLoading && errorMessage && (
          <div className="mt-6 rounded-lg border border-err-edge bg-err-bg p-4 text-sm text-err">
            <p>Could not load searchable songs.</p>
            <p className="mt-1">{errorMessage}</p>
          </div>
        )}

        {hasSearched && !isLoading && !errorMessage && songs.length === 0 && (
          <p className="mt-6 rounded-lg bg-surface p-4 text-sm text-ink">
            No songs found yet. Add and review albums to start searching.
          </p>
        )}

        {hasSearched && !isLoading && !errorMessage && songs.length > 0 && filteredSongs.length === 0 && !validationMessage && (
          <p className="mt-6 rounded-lg bg-surface p-4 text-sm text-ink">
            No songs matched the current filters.
          </p>
        )}

        {hasSearched && !isLoading && !errorMessage && filteredSongs.length > 0 && (
          <section className="mt-6 space-y-3">
            {filteredSongs.map((song) => (
              <article
                key={`${song.userSavedAlbumId}:${song.trackNumber}`}
                className="rounded-xl border border-edge bg-surface p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                    <AlbumCover src={song.coverUrl} alt={`${song.albumTitle} cover`} loading="lazy" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold text-ink">
                      {song.trackNumber}. {song.trackTitle}
                    </p>
                    <p className="text-sm font-semibold text-ink">{song.artistName}</p>
                    <p className="text-sm text-ink-2">{song.albumTitle}</p>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-surface-2 px-2 py-1 font-semibold text-ink-2">
                        Score: {formatScore(song.score)}
                      </span>
                      <span className="rounded-full bg-surface-2 px-2 py-1 font-semibold text-ink-2">
                        {song.isInterlude ? 'Interlude' : 'Track'}
                      </span>
                      {song.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-indigo-100 px-2 py-1 font-semibold text-indigo-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    

                    {song.reviewNotes.trim() && (
                      <p className="mt-2 text-sm text-ink-2">
                        <span className="font-semibold text-ink">Notes:</span> {song.reviewNotes}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/reviews/${song.userSavedAlbumId}`)}
                    className="rounded-lg bg-cta px-3 py-2 text-sm font-semibold text-white"
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
