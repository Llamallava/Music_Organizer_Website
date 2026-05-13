import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import AlbumCover from '../components/AlbumCover'
import { getFriendsOverviewForCurrentUser } from '../lib/db/friendsData'
import { getAlbumWorkspaceForUser, type AlbumWorkspace, type ReviewSection } from '../lib/db/reviewsData'

const CONCLUSION_KEY = 'conclusion'
const toTrackKey = (trackNumber: number) => `track:${trackNumber}`
const getDisplayName = (username: string | null | undefined) => username?.trim() || 'Unnamed User'
const toPossessiveName = (name: string) => (name.endsWith('s') || name.endsWith('S') ? `${name}'` : `${name}'s`)

const parseTrackNumberFromKey = (key: string): number | null => {
  if (!key.startsWith('track:')) return null
  const trackNumber = Number(key.replace('track:', ''))
  if (!Number.isInteger(trackNumber) || trackNumber <= 0) return null
  return trackNumber
}

const formatDuration = (secs: number | null): string => {
  if (!secs || secs <= 0) return ''
  const total = Math.round(secs)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function FriendAlbumReviewPage() {
  const { friendUserId, userSavedAlbumId } = useParams<{ friendUserId: string; userSavedAlbumId: string }>()
  const [workspace, setWorkspace] = useState<AlbumWorkspace | null>(null)
  const [friendName, setFriendName] = useState<string | null>(null)
  const [activeSectionKey, setActiveSectionKey] = useState<string>(CONCLUSION_KEY)
  const [activeNotesTab, setActiveNotesTab] = useState<'lyrically' | 'sonically'>('lyrically')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!friendUserId || !userSavedAlbumId) {
      setErrorMessage('Missing review identifier.')
      setIsLoading(false)
      return
    }

    let isActive = true

    const loadWorkspace = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const [overview, loadedWorkspace] = await Promise.all([
          getFriendsOverviewForCurrentUser(),
          getAlbumWorkspaceForUser(friendUserId, userSavedAlbumId),
        ])

        if (!isActive) return

        const friend = overview.friends.find((entry) => entry.userId === friendUserId)
        if (!friend) {
          setWorkspace(null)
          setFriendName(null)
          setErrorMessage('This friend is not in your current list.')
          return
        }

        if (!loadedWorkspace) {
          setWorkspace(null)
          setFriendName(getDisplayName(friend.username))
          setErrorMessage('Album review not found.')
          return
        }

        const firstTrack = loadedWorkspace.tracks[0]
        setWorkspace(loadedWorkspace)
        setFriendName(getDisplayName(friend.username))
        setActiveSectionKey(firstTrack ? toTrackKey(firstTrack.trackNumber) : CONCLUSION_KEY)
      } catch (error) {
        if (!isActive) return
        const message = error instanceof Error ? error.message : 'Failed to load friend review workspace.'
        setErrorMessage(message)
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    void loadWorkspace()
    return () => { isActive = false }
  }, [friendUserId, userSavedAlbumId])

  const activeTrack = useMemo(() => {
    if (!workspace) return null
    const trackNumber = parseTrackNumberFromKey(activeSectionKey)
    if (!trackNumber) return null
    return workspace.tracks.find((track) => track.trackNumber === trackNumber) ?? null
  }, [activeSectionKey, workspace])

  const activeSection = useMemo<ReviewSection | null>(() => {
    if (!workspace) return null
    if (activeSectionKey === CONCLUSION_KEY) {
      return workspace.sections.find((section) => section.sectionType === 'conclusion') ?? null
    }
    const trackNumber = parseTrackNumberFromKey(activeSectionKey)
    if (!trackNumber) return null
    return workspace.sections.find(
      (section) => section.sectionType === 'track' && section.trackNumber === trackNumber,
    ) ?? null
  }, [activeSectionKey, workspace])

  if (isLoading) {
    return <main className="min-h-screen px-6 py-8"><p className="vco-loading">Loading review workspace...</p></main>
  }

  if (!workspace) {
    return (
      <main className="min-h-screen px-6 py-8">
        <div className="vco-msg-err" style={{ marginTop: 20 }}>
          {errorMessage ?? 'Could not load this album review.'}
        </div>
      </main>
    )
  }

  const displayName = friendName ?? 'Friend'
  const totalSeconds = workspace.tracks.reduce((sum, t) => sum + (t.durationSeconds ?? 0), 0)
  const totalRuntime = formatDuration(totalSeconds)
  const releaseYear = workspace.album.releaseDate ? workspace.album.releaseDate.slice(0, 4) : ''
  const activeChNum = activeTrack ? String(activeTrack.trackNumber).padStart(2, '0') : '—'
  const trackList = workspace.tracks
  const isLastSection = activeSectionKey === CONCLUSION_KEY

  const scoreText =
    activeSection?.score === null || activeSection?.score === undefined
      ? '—'
      : activeSection.score.toFixed(1)

  const notesLyricallyText = activeSection?.notesLyrically ?? ''
  const notesSonicallyText = activeSection?.notesSonically ?? ''

  const navigate = (key: string) => setActiveSectionKey(key)

  return (
    <main className="vco-page">
      <div className="vco-case">
        <div className="vco-body">

          {/* LEFT: Album info + tracklist */}
          <aside className="vco-left">
            <div className="vco-cover-wrap">
              <AlbumCover
                src={workspace.album.coverUrl}
                alt={`${workspace.album.title} cover`}
                loading="eager"
              />
            </div>
            <div className="vco-album-meta">
              <div className="vco-album-title">{workspace.album.title}</div>
              <div className="vco-album-artist">{workspace.album.artistName}</div>
              <div className="vco-album-info">
                {[releaseYear, `${workspace.album.totalTracks} tracks`, totalRuntime]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>

            <div className="vco-timeline">
              {workspace.tracks.map((track) => {
                const key = toTrackKey(track.trackNumber)
                const isActive = key === activeSectionKey
                const widthPct = totalSeconds > 0 && track.durationSeconds
                  ? (track.durationSeconds / totalSeconds) * 100
                  : 100 / trackList.length
                return (
                  <button
                    key={track.id}
                    type="button"
                    className={`vco-tl-seg${isActive ? ' active' : ''}`}
                    style={{ width: `${widthPct}%` }}
                    onClick={() => navigate(key)}
                    title={`${String(track.trackNumber).padStart(2, '0')} ${track.title}`}
                    aria-label={track.title}
                  />
                )
              })}
            </div>

            <nav className="vco-tracklist">
              {workspace.tracks.map((track) => {
                const key = toTrackKey(track.trackNumber)
                const isActive = key === activeSectionKey
                const section = workspace.sections.find(
                  (s) => s.sectionType === 'track' && s.trackNumber === track.trackNumber,
                )
                const scoreDisp = section?.score !== null && section?.score !== undefined
                  ? section.score.toFixed(1)
                  : ''
                return (
                  <button
                    key={track.id}
                    type="button"
                    className={`vco-tl-item${isActive ? ' active' : ''}`}
                    onClick={() => navigate(key)}
                  >
                    <span className="vco-tl-num">{String(track.trackNumber).padStart(2, '0')}</span>
                    <span className="vco-tl-title">{track.title}</span>
                    {scoreDisp && <span className="vco-tl-score">{scoreDisp}</span>}
                  </button>
                )
              })}
              <button
                type="button"
                className={`vco-tl-item vco-tl-conc${isLastSection ? ' active' : ''}`}
                onClick={() => navigate(CONCLUSION_KEY)}
              >
                <span className="vco-tl-num">★</span>
                <span className="vco-tl-title">Conclusion</span>
                {(() => {
                  const s = workspace.sections.find((sec) => sec.sectionType === 'conclusion')
                  return s?.score !== null && s?.score !== undefined
                    ? <span className="vco-tl-score">{s.score.toFixed(1)}</span>
                    : null
                })()}
              </button>
            </nav>
          </aside>

          {/* CENTER: Read-only notes */}
          <section className="vco-center">
            <header className="vco-track-bar">
              <div className="vco-track-info">
                <span className="tn">{activeTrack ? `${activeChNum}.` : '★'}</span>
                <span className="tt">{activeTrack ? activeTrack.title : 'Conclusion'}</span>
                {activeTrack?.durationSeconds ? (
                  <span className="rt">{formatDuration(activeTrack.durationSeconds)}</span>
                ) : null}
              </div>
              <div className="vco-toggles">
                {activeTrack && (
                  <>
                    <button
                      type="button"
                      className={`vco-toggle${activeNotesTab === 'lyrically' ? ' on' : ''}`}
                      onClick={() => setActiveNotesTab('lyrically')}
                    >
                      Lyrically
                    </button>
                    <button
                      type="button"
                      className={`vco-toggle${activeNotesTab === 'sonically' ? ' on' : ''}`}
                      onClick={() => setActiveNotesTab('sonically')}
                    >
                      Sonically
                    </button>
                  </>
                )}
              </div>
            </header>

            <div className="vco-text-wrap">
              {activeTrack ? (
                <textarea
                  key={`${activeSectionKey}-${activeNotesTab}`}
                  className="vco-text-panel"
                  value={activeNotesTab === 'lyrically' ? notesLyricallyText : notesSonicallyText}
                  readOnly
                  placeholder="No notes written for this section."
                  style={{ borderLeftColor: 'hsl(var(--accent-h) var(--accent-s) var(--accent-l) / 0.5)' }}
                />
              ) : (
                <textarea
                  className="vco-text-panel"
                  value={notesLyricallyText}
                  readOnly
                  placeholder="No notes written for this section."
                  style={{ borderLeftColor: 'rgba(219,39,119,0.5)' }}
                />
              )}
            </div>

            <footer className="vco-transport">
              <span
                className="vco-meta"
                style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}
              >
                {toPossessiveName(displayName)} reviews · read-only
              </span>
              <span className="vco-timecode">
                {activeTrack ? activeChNum : '★'} / {trackList.length}
              </span>
            </footer>
          </section>

          {/* RIGHT: Score + lyrics */}
          <aside className="vco-right">
            <div className="vco-dial-wrap">
              <div className="vco-dial" role="presentation">
                <div className="vco-dial-inner">{scoreText}</div>
              </div>
              <div className="vco-dial-info">
                <div className="lab">Score</div>
                <div className="val">
                  {scoreText}<span>/10</span>
                </div>
              </div>
            </div>

            <div className="vco-lyr-panel">
              <header className="vco-lyr-head">
                <span>{activeTrack ? `Lyrics · ${activeChNum}` : 'Lyrics'}</span>
              </header>
              <div className="vco-lyr-body">
                {!activeTrack ? (
                  <p className="vco-lyr-empty">Conclusion has no lyrics.</p>
                ) : activeTrack.lyrics.trim() ? (
                  <pre className="vco-lyr-pre">{activeTrack.lyrics}</pre>
                ) : (
                  <p className="vco-lyr-empty">No lyrics stored for this track.</p>
                )}
              </div>
            </div>
          </aside>

        </div>
      </div>
    </main>
  )
}

export default FriendAlbumReviewPage
