import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AlbumCover from '../components/AlbumCover'
import { StellarHorizon } from '../components/StellarHorizon'
import { updateTrackScoreForCurrentUser } from '../lib/db/reviewsData'
import { listSearchSongsForCurrentUser, type SearchSongRecord } from '../lib/db/searchData'

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

const fieldInputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 6,
  borderRadius: 6,
  border: '1px solid #2a2548',
  padding: '7px 10px',
  fontSize: 12,
}

const fieldSelectStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 6,
  borderRadius: 6,
  border: '1px solid #2a2548',
  padding: '7px 10px',
  fontSize: 12,
}

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontFamily: "'JetBrains Mono', monospace",
  letterSpacing: '1.5px',
  textTransform: 'uppercase' as const,
  color: '#7c6fad',
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
  const [maxScoreInput, setMaxScoreInput] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('artist')
  const [hasSearched, setHasSearched] = useState(false)

  const [quickEditKey, setQuickEditKey] = useState<string | null>(null)
  const [quickEditInput, setQuickEditInput] = useState('')
  const [quickEditSaving, setQuickEditSaving] = useState(false)
  const [quickEditError, setQuickEditError] = useState<string | null>(null)

  const minScoreValue = parseOptionalNumber(minScoreInput).value
  const maxScoreValue = parseOptionalNumber(maxScoreInput).value

  useEffect(() => {
    if (minScoreValue !== null || maxScoreValue !== null) {
      setSortOrder((current) => (current === 'artist' ? 'score-asc' : current))
    }
  }, [minScoreValue, maxScoreValue])

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
      parsedMinScore.value !== null &&
      parsedMaxScore.value !== null &&
      parsedMinScore.value > parsedMaxScore.value
    ) {
      return 'Min score cannot be greater than max score.'
    }

    return null
  }, [parsedMaxScore, parsedMinScore])

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

        if (minScore !== null && song.score < minScore) {
          return false
        }

        if (maxScore !== null && song.score > maxScore) {
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

  const openQuickEdit = (song: SearchSongRecord) => {
    setQuickEditKey(`${song.userSavedAlbumId}:${song.trackNumber}`)
    setQuickEditInput(song.score !== null ? String(song.score) : '')
    setQuickEditError(null)
  }

  const closeQuickEdit = () => {
    setQuickEditKey(null)
    setQuickEditInput('')
    setQuickEditError(null)
  }

  const saveQuickEdit = async (song: SearchSongRecord) => {
    const trimmed = quickEditInput.trim()
    let newScore: number | null

    if (trimmed === '') {
      newScore = null
    } else {
      const parsed = Number(trimmed)
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 10) {
        setQuickEditError('Score must be a number between 0 and 10.')
        return
      }
      newScore = Number(parsed.toFixed(1))
    }

    setQuickEditSaving(true)
    setQuickEditError(null)

    try {
      await updateTrackScoreForCurrentUser({
        userSavedAlbumId: song.userSavedAlbumId,
        trackNumber: song.trackNumber,
        isInterlude: song.isInterlude,
        score: newScore,
      })

      setSongs((prev) =>
        prev.map((s) =>
          s.userSavedAlbumId === song.userSavedAlbumId && s.trackNumber === song.trackNumber
            ? { ...s, score: newScore }
            : s
        )
      )

      closeQuickEdit()
    } catch (error) {
      setQuickEditError(error instanceof Error ? error.message : 'Failed to save score.')
    } finally {
      setQuickEditSaving(false)
    }
  }

  const clearFilters = () => {
    setArtistQuery('')
    setAlbumQuery('')
    setTrackQuery('')
    setLyricsQuery('')
    setNotesQuery('')
    setScoreMode('any')
    setInterludeMode('any')
    setMinScoreInput('')
    setMaxScoreInput('')
    setSortOrder('artist')
    setHasSearched(false)
  }

  return (
    <main className="page-wrap">
      <h1 className="page-title">Search Songs</h1>
      <p style={{ marginTop: 6, fontSize: 13, color: '#7c6fad', fontFamily: "'JetBrains Mono', monospace" }}>
        Combine filters to answer questions like lyrics keyword matches or artist + score ranges.
      </p>

      <section className="vco-panel" style={{ marginTop: 20, padding: '16px 20px' }}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label style={fieldLabelStyle}>
            Artist contains
            <input type="text" value={artistQuery} onChange={(event) => setArtistQuery(event.target.value)} style={fieldInputStyle} />
          </label>

          <label style={fieldLabelStyle}>
            Album contains
            <input type="text" value={albumQuery} onChange={(event) => setAlbumQuery(event.target.value)} style={fieldInputStyle} />
          </label>

          <label style={fieldLabelStyle}>
            Song contains
            <input type="text" value={trackQuery} onChange={(event) => setTrackQuery(event.target.value)} style={fieldInputStyle} />
          </label>

          <label style={fieldLabelStyle}>
            Lyrics contain
            <input type="text" value={lyricsQuery} onChange={(event) => setLyricsQuery(event.target.value)} style={fieldInputStyle} />
          </label>

          <label style={fieldLabelStyle}>
            Notes contain
            <input type="text" value={notesQuery} onChange={(event) => setNotesQuery(event.target.value)} style={fieldInputStyle} />
          </label>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label style={fieldLabelStyle}>
            Score mode
            <select value={scoreMode} onChange={(event) => setScoreMode(event.target.value as ScoreMode)} style={fieldSelectStyle}>
              <option value="any">Any</option>
              <option value="scored">Scored only</option>
              <option value="unscored">Unscored only</option>
            </select>
          </label>

          <label style={fieldLabelStyle}>
            Interludes
            <select value={interludeMode} onChange={(event) => setInterludeMode(event.target.value as InterludeMode)} style={fieldSelectStyle}>
              <option value="any">Any</option>
              <option value="only">Interludes only</option>
              <option value="exclude">Exclude interludes</option>
            </select>
          </label>

          <div style={fieldLabelStyle}>
            Score range
            <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="min"
                value={minScoreInput}
                onChange={(event) => setMinScoreInput(event.target.value)}
                style={{ ...fieldInputStyle, marginTop: 0, flex: 1 }}
              />
              <span style={{ color: '#4a3f7a', fontSize: 14, flexShrink: 0 }}>–</span>
              <input
                type="text"
                placeholder="max"
                value={maxScoreInput}
                onChange={(event) => setMaxScoreInput(event.target.value)}
                style={{ ...fieldInputStyle, marginTop: 0, flex: 1 }}
              />
            </div>
          </div>

          <label style={fieldLabelStyle}>
            Sort
            <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)} style={fieldSelectStyle}>
              <option value="artist">Artist / Album / Track</option>
              <option value="score-desc">Score high to low</option>
              <option value="score-asc">Score low to high</option>
              <option value="recent">Recently added albums</option>
            </select>
          </label>
        </div>

        <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTop: '1px solid #2a2548', paddingTop: 12 }}>
          {hasSearched ? (
            <p className="vco-label">
              Results: <span style={{ color: '#c4b5fd' }}>{filteredSongs.length}</span>
            </p>
          ) : (
            <span />
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={clearFilters} className="vco-tbtn">
              Clear Filters
            </button>
            <button type="button" onClick={() => setHasSearched(true)} className="vco-tbtn primary">
              Search
            </button>
          </div>
        </div>

        {validationMessage && (
          <div className="vco-msg-err" style={{ marginTop: 10 }}>
            {validationMessage}
          </div>
        )}
      </section>

      <StellarHorizon label="SCANNING THE SKY" />

      {hasSearched && isLoading && <p className="vco-loading">Loading songs...</p>}

      {hasSearched && !isLoading && errorMessage && (
        <div className="vco-msg-err" style={{ marginTop: 20 }}>
          Could not load searchable songs. {errorMessage}
        </div>
      )}

      {hasSearched && !isLoading && !errorMessage && songs.length === 0 && (
        <p className="vco-empty">No songs found yet. Add and review albums to start searching.</p>
      )}

      {hasSearched && !isLoading && !errorMessage && songs.length > 0 && filteredSongs.length === 0 && !validationMessage && (
        <p className="vco-empty">No songs matched the current filters.</p>
      )}

      {hasSearched && !isLoading && !errorMessage && filteredSongs.length > 0 && (
        <section style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredSongs.map((song) => {
            const songKey = `${song.userSavedAlbumId}:${song.trackNumber}`
            const isEditing = quickEditKey === songKey

            return (
              <article
                key={songKey}
                className="vco-panel"
                style={{ padding: '14px 16px' }}
              >
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ width: 72, height: 72, flexShrink: 0, overflow: 'hidden', borderRadius: 6, background: '#141028' }}>
                    <AlbumCover src={song.coverUrl} alt={`${song.albumTitle} cover`} loading="lazy" />
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#ede9fe' }}>
                      {song.trackNumber}. {song.trackTitle}
                    </p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#c4b5fd' }}>{song.artistName}</p>
                    <p style={{ fontSize: 12, color: '#7c6fad' }}>{song.albumTitle}</p>

                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#c4b5fd', letterSpacing: '0.5px' }}>Score:</span>
                          <input
                            type="number"
                            min={0}
                            max={10}
                            step={0.1}
                            value={quickEditInput}
                            onChange={(e) => setQuickEditInput(e.target.value)}
                            placeholder="0–10"
                            autoFocus
                            style={{
                              width: 72,
                              borderRadius: 4,
                              border: '1px solid #7c6fad',
                              background: '#1c1836',
                              padding: '2px 6px',
                              fontSize: 12,
                              fontFamily: "'JetBrains Mono', monospace",
                              color: '#ede9fe',
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void saveQuickEdit(song)
                              if (e.key === 'Escape') closeQuickEdit()
                            }}
                          />
                        </div>
                      ) : (
                        <span style={{ borderRadius: 4, border: '1px solid #2a2548', background: '#1c1836', padding: '2px 8px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#c4b5fd' }}>
                          Score: {formatScore(song.score)}
                        </span>
                      )}
                      <span style={{ borderRadius: 4, border: '1px solid #2a2548', background: '#1c1836', padding: '2px 8px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#7c6fad' }}>
                        {song.isInterlude ? 'Interlude' : 'Track'}
                      </span>
                    </div>

                    {isEditing && quickEditError && (
                      <p style={{ marginTop: 6, fontSize: 11, color: '#f87171', fontFamily: "'JetBrains Mono', monospace" }}>
                        {quickEditError}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void saveQuickEdit(song)}
                          className="vco-tbtn primary"
                          disabled={quickEditSaving}
                        >
                          {quickEditSaving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={closeQuickEdit}
                          className="vco-tbtn"
                          disabled={quickEditSaving}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => navigate(`/reviews/${song.userSavedAlbumId}`)}
                          className="vco-tbtn primary"
                        >
                          Open Review
                        </button>
                        <button
                          type="button"
                          onClick={() => openQuickEdit(song)}
                          className="vco-tbtn"
                        >
                          Quick Edit
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </section>
      )}
    </main>
  )
}

export default SearchPage
