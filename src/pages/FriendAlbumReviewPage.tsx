import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import AlbumCover from '../components/AlbumCover'
import LinearBackButton from '../components/LinearBackButton'
import { getFriendsOverviewForCurrentUser } from '../lib/db/friendsData'
import { getAlbumWorkspaceForUser, type AlbumWorkspace, type ReviewSection } from '../lib/db/reviewsData'

const CONCLUSION_KEY = 'conclusion'
const toTrackKey = (trackNumber: number) => `track:${trackNumber}`
const getDisplayName = (username: string | null | undefined) => username?.trim() || 'Unnamed User'
const toPossessiveName = (name: string) => (name.endsWith('s') || name.endsWith('S') ? `${name}'` : `${name}'s`)

const parseTrackNumberFromKey = (key: string): number | null => {
  if (!key.startsWith('track:')) {
    return null
  }

  const trackNumber = Number(key.replace('track:', ''))
  if (!Number.isInteger(trackNumber) || trackNumber <= 0) {
    return null
  }

  return trackNumber
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

        if (!isActive) {
          return
        }

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
        if (!isActive) {
          return
        }

        const message = error instanceof Error ? error.message : 'Failed to load friend review workspace.'
        setErrorMessage(message)
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadWorkspace()

    return () => {
      isActive = false
    }
  }, [friendUserId, userSavedAlbumId])

  const activeTrack = useMemo(() => {
    if (!workspace) {
      return null
    }

    const trackNumber = parseTrackNumberFromKey(activeSectionKey)
    if (!trackNumber) {
      return null
    }

    return workspace.tracks.find((track) => track.trackNumber === trackNumber) ?? null
  }, [activeSectionKey, workspace])

  const activeSection = useMemo<ReviewSection | null>(() => {
    if (!workspace) {
      return null
    }

    if (activeSectionKey === CONCLUSION_KEY) {
      return workspace.sections.find((section) => section.sectionType === 'conclusion') ?? null
    }

    const trackNumber = parseTrackNumberFromKey(activeSectionKey)
    if (!trackNumber) {
      return null
    }

    return (
      workspace.sections.find(
        (section) => section.sectionType === 'track' && section.trackNumber === trackNumber,
      ) ?? null
    )
  }, [activeSectionKey, workspace])

  if (isLoading) {
    return (
      <main className="min-h-screen px-6 py-8">
        <div className="mx-auto w-full max-w-6xl">
          <LinearBackButton />
          <p className="mt-6 rounded-lg bg-surface px-4 py-3 text-sm text-ink">
            Loading review workspace...
          </p>
        </div>
      </main>
    )
  }

  if (!workspace) {
    return (
      <main className="min-h-screen px-6 py-8">
        <div className="mx-auto w-full max-w-6xl">
          <LinearBackButton />

          <h1 className="mt-5 text-5xl font-black tracking-tight text-ink">
            {toPossessiveName(friendName ?? 'Friend')} Reviews
          </h1>

          <div className="mt-6 rounded-lg border border-err-edge bg-err-bg p-4 text-sm text-err">
            {errorMessage ?? 'Could not load this album review.'}
          </div>
        </div>
      </main>
    )
  }

  const displayName = friendName ?? 'Friend'
  const scoreText = activeSection?.score === null || activeSection?.score === undefined
    ? 'Unscored'
    : `${activeSection.score}/10`
  const notesLyricallyText = activeSection?.notesLyrically ?? ''
  const notesSonicallyText = activeSection?.notesSonically ?? ''

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto w-full max-w-[2400px]">
        <LinearBackButton />

        <h1 className="mt-5 text-5xl font-black tracking-tight text-ink">
          {toPossessiveName(displayName)} Reviews
        </h1>
        <p className="mt-1 text-sm text-ink-2">Read-only view.</p>

        <section className="mt-6 grid gap-4 lg:grid-cols-[clamp(240px,18%,500px)_minmax(0,1fr)_clamp(280px,21%,560px)]">
          <aside className="space-y-4">
            <div className="rounded-xl border border-edge bg-surface p-4">
              <div className="aspect-square w-full overflow-hidden rounded-lg bg-surface-2">
                <AlbumCover src={workspace.album.coverUrl} alt={`${workspace.album.title} cover`} loading="eager" />
              </div>
              <h2 className="mt-3 text-base font-bold text-ink">{workspace.album.title}</h2>
              <p className="text-sm text-ink">{workspace.album.artistName}</p>
            </div>

            <div className="rounded-xl border border-edge bg-surface p-3">
              <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Tracklist</p>
              <div className="max-h-[60vh] space-y-1 overflow-auto pr-1">
                {workspace.tracks.map((track) => {
                  const key = toTrackKey(track.trackNumber)
                  const isActive = key === activeSectionKey

                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => setActiveSectionKey(key)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                        isActive ? 'bg-cta text-white' : 'bg-surface-2 text-ink hover:bg-surface-3'
                      }`}
                    >
                      <span className="mr-2 font-semibold">{track.trackNumber}.</span>
                      {track.title}
                    </button>
                  )
                })}

                <button
                  type="button"
                  onClick={() => setActiveSectionKey(CONCLUSION_KEY)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold ${
                    activeSectionKey === CONCLUSION_KEY
                      ? 'bg-cta text-white'
                      : 'bg-surface-2 text-pink hover:bg-surface-3'
                  }`}
                >
                  Conclusion
                </button>
              </div>
            </div>
          </aside>

          <section className="rounded-xl border border-edge bg-surface p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Review Section</p>
                <h2 className="text-lg font-bold text-ink">
                  {activeTrack ? `${activeTrack.trackNumber}. ${activeTrack.title}` : 'Conclusion'}
                </h2>
              </div>

              <p className="rounded-md bg-surface-2 px-3 py-1 text-sm font-semibold text-ink">
                Score: {scoreText}
              </p>
            </div>

            {activeTrack && activeSection?.isInterlude && (
              <p className="mb-3 inline-flex rounded-md bg-warn-bg px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-warn">
                Interlude
              </p>
            )}

            {activeTrack && (
              <div className="mb-3 flex rounded-md border border-edge overflow-hidden text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveNotesTab('lyrically')}
                  className={`px-3 py-1 ${activeNotesTab === 'lyrically' ? 'bg-cta text-white' : 'bg-surface text-ink hover:bg-surface-2'}`}
                >
                  Lyrically
                </button>
                <button
                  type="button"
                  onClick={() => setActiveNotesTab('sonically')}
                  className={`px-3 py-1 border-l border-edge ${activeNotesTab === 'sonically' ? 'bg-cta text-white' : 'bg-surface text-ink hover:bg-surface-2'}`}
                >
                  Sonically
                </button>
              </div>
            )}

            {activeTrack ? (
              <textarea
                key={`${activeSectionKey}-${activeNotesTab}`}
                value={activeNotesTab === 'lyrically' ? notesLyricallyText : notesSonicallyText}
                readOnly
                placeholder="No notes written for this section."
                className="h-[62vh] w-full resize-none rounded-lg border border-edge bg-surface-2 p-3 text-sm leading-relaxed text-ink"
              />
            ) : (
              <textarea
                value={notesLyricallyText}
                readOnly
                placeholder="No notes written for this section."
                className="h-[62vh] w-full resize-none rounded-lg border border-edge bg-surface-2 p-3 text-sm leading-relaxed text-ink"
              />
            )}
          </section>

          <aside className="rounded-xl border border-edge bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Lyrics</p>
            {activeTrack ? (
              activeTrack.lyrics.trim() ? (
                <pre className="mt-2 max-h-[72vh] overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {activeTrack.lyrics}
                </pre>
              ) : (
                <p className="mt-2 text-sm text-ink-2">No lyrics stored for this track.</p>
              )
            ) : (
              <p className="mt-2 text-sm text-ink-2">Conclusion has no lyrics.</p>
            )}
          </aside>
        </section>
      </div>
    </main>
  )
}

export default FriendAlbumReviewPage
