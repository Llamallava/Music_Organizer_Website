import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import AlbumCover from '../components/AlbumCover'
import LinearBackButton from '../components/LinearBackButton'
import { getFriendsOverviewForCurrentUser, type FriendProfile } from '../lib/db/friendsData'
import {
  getAlbumWorkspaceForCurrentUser,
  upsertConclusionSectionForCurrentUser,
  upsertTrackReviewSectionForCurrentUser,
  type AlbumWorkspace,
} from '../lib/db/reviewsData'
import {
  addSongToPlaylistForCurrentUser,
  listPlaylistOptionsForCurrentUser,
  type PlaylistOption,
} from '../lib/db/playlistsData'
import { sendRecommendationForCurrentUser, type RecommendationType } from '../lib/db/toListenData'

type SectionDraft = {
  notes: string
  scoreInput: string
  isInterlude: boolean
}

type DraftMap = Record<string, SectionDraft>
type PlaylistSelection = {
  trackNumber: number
  itemTitle: string
  artistName: string
}

const CONCLUSION_KEY = 'conclusion'

const toTrackKey = (trackNumber: number) => `track:${trackNumber}`
const getFriendDisplayName = (friend: FriendProfile) => friend.username?.trim() || friend.friendCode

const defaultDraft = (): SectionDraft => ({
  notes: '',
  scoreInput: '',
  isInterlude: false,
})

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

const parseScoreInput = (scoreInput: string): number | null => {
  const trimmed = scoreInput.trim()
  if (!trimmed) {
    return null
  }

  const score = Number(trimmed)
  if (Number.isNaN(score) || score < 0 || score > 10) {
    throw new Error('Score must be a number between 0 and 10.')
  }

  return Number(score.toFixed(1))
}

const buildInitialDraftMap = (workspace: AlbumWorkspace): DraftMap => {
  const map: DraftMap = {}

  for (const section of workspace.sections) {
    if (section.sectionType === 'track' && section.trackNumber) {
      map[toTrackKey(section.trackNumber)] = {
        notes: section.notes,
        scoreInput: section.score === null ? '' : String(section.score),
        isInterlude: section.isInterlude,
      }
      continue
    }

    if (section.sectionType === 'conclusion') {
      map[CONCLUSION_KEY] = {
        notes: section.notes,
        scoreInput: section.score === null ? '' : String(section.score),
        isInterlude: false,
      }
    }
  }

  for (const track of workspace.tracks) {
    const key = toTrackKey(track.trackNumber)
    map[key] ??= defaultDraft()
  }

  map[CONCLUSION_KEY] ??= defaultDraft()

  return map
}

function AlbumReviewPage() {
  const { userSavedAlbumId } = useParams()
  const [workspace, setWorkspace] = useState<AlbumWorkspace | null>(null)
  const [friends, setFriends] = useState<FriendProfile[]>([])
  const [selectedRecommendationFriendUserId, setSelectedRecommendationFriendUserId] = useState('')
  const [recommendationType, setRecommendationType] = useState<RecommendationType>('song')
  const [recommendationItemTitle, setRecommendationItemTitle] = useState('')
  const [recommendationArtistName, setRecommendationArtistName] = useState('')
  const [isRecommendationModalOpen, setIsRecommendationModalOpen] = useState(false)
  const [isRecommendationSubmitting, setIsRecommendationSubmitting] = useState(false)
  const [recommendationErrorMessage, setRecommendationErrorMessage] = useState<string | null>(null)
  const [playlists, setPlaylists] = useState<PlaylistOption[]>([])
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('')
  const [playlistSelection, setPlaylistSelection] = useState<PlaylistSelection | null>(null)
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false)
  const [isPlaylistSubmitting, setIsPlaylistSubmitting] = useState(false)
  const [playlistErrorMessage, setPlaylistErrorMessage] = useState<string | null>(null)
  const [activeSectionKey, setActiveSectionKey] = useState<string>(CONCLUSION_KEY)
  const [draftBySection, setDraftBySection] = useState<DraftMap>({})
  const [savedBySection, setSavedBySection] = useState<DraftMap>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!userSavedAlbumId) {
      setErrorMessage('Missing album id.')
      setIsLoading(false)
      return
    }

    let isActive = true

    const loadWorkspace = async () => {
      setIsLoading(true)
      setErrorMessage(null)
      setInfoMessage(null)

      try {
        const [loadedWorkspace, friendsOverview, playlistOptions] = await Promise.all([
          getAlbumWorkspaceForCurrentUser(userSavedAlbumId),
          getFriendsOverviewForCurrentUser(),
          listPlaylistOptionsForCurrentUser(),
        ])

        if (!isActive) {
          return
        }

        setFriends(friendsOverview.friends)
        setSelectedRecommendationFriendUserId(
          (previous) => previous || friendsOverview.friends[0]?.userId || '',
        )
        setPlaylists(playlistOptions)
        setSelectedPlaylistId((previous) => previous || playlistOptions[0]?.id || '')

        if (!loadedWorkspace) {
          setWorkspace(null)
          setErrorMessage('Album review not found.')
          setIsLoading(false)
          return
        }

        const draftMap = buildInitialDraftMap(loadedWorkspace)
        const firstTrack = loadedWorkspace.tracks[0]

        setWorkspace(loadedWorkspace)
        setDraftBySection(draftMap)
        setSavedBySection(draftMap)
        setActiveSectionKey(firstTrack ? toTrackKey(firstTrack.trackNumber) : CONCLUSION_KEY)
      } catch (error) {
        if (!isActive) {
          return
        }

        const message = error instanceof Error ? error.message : 'Failed to load review workspace.'
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
  }, [userSavedAlbumId])

  const activeDraft = draftBySection[activeSectionKey] ?? defaultDraft()
  const activeSavedDraft = savedBySection[activeSectionKey] ?? defaultDraft()
  const isDirty =
    activeDraft.notes !== activeSavedDraft.notes ||
    activeDraft.scoreInput !== activeSavedDraft.scoreInput ||
    activeDraft.isInterlude !== activeSavedDraft.isInterlude

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

  const handleNotesChange = (value: string) => {
    setDraftBySection((previous) => ({
      ...previous,
      [activeSectionKey]: {
        ...(previous[activeSectionKey] ?? defaultDraft()),
        notes: value,
      },
    }))
  }

  const handleScoreChange = (value: string) => {
    setDraftBySection((previous) => ({
      ...previous,
      [activeSectionKey]: {
        ...(previous[activeSectionKey] ?? defaultDraft()),
        scoreInput: value,
      },
    }))
  }

  const handleInterludeChange = (value: boolean) => {
    setDraftBySection((previous) => ({
      ...previous,
      [activeSectionKey]: {
        ...(previous[activeSectionKey] ?? defaultDraft()),
        isInterlude: value,
      },
    }))
  }

  const openRecommendationModal = (params: {
    recommendationType: RecommendationType
    itemTitle: string
    artistName: string
  }) => {
    setRecommendationErrorMessage(null)
    setIsPlaylistModalOpen(false)
    setRecommendationType(params.recommendationType)
    setRecommendationItemTitle(params.itemTitle)
    setRecommendationArtistName(params.artistName)
    setIsRecommendationModalOpen(true)
  }

  const openPlaylistModal = (selection: PlaylistSelection) => {
    setPlaylistErrorMessage(null)
    setIsRecommendationModalOpen(false)
    setPlaylistSelection(selection)
    setIsPlaylistModalOpen(true)
  }

  const handleSendRecommendation = async () => {
    if (!workspace || !recommendationItemTitle || !recommendationArtistName) {
      return
    }

    setRecommendationErrorMessage(null)
    setInfoMessage(null)
    setIsRecommendationSubmitting(true)

    try {
      await sendRecommendationForCurrentUser({
        friendUserId: selectedRecommendationFriendUserId,
        recommendationType,
        songName: recommendationItemTitle,
        artistName: recommendationArtistName,
      })

      setIsRecommendationModalOpen(false)
      setInfoMessage('Recommendation sent.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send recommendation.'
      setRecommendationErrorMessage(message)
    } finally {
      setIsRecommendationSubmitting(false)
    }
  }

  const handleAddSongToPlaylist = async () => {
    if (!workspace || !playlistSelection) {
      return
    }

    setPlaylistErrorMessage(null)
    setInfoMessage(null)
    setIsPlaylistSubmitting(true)

    try {
      await addSongToPlaylistForCurrentUser({
        playlistId: selectedPlaylistId,
        userSavedAlbumId: workspace.userSavedAlbumId,
        trackNumber: playlistSelection.trackNumber,
      })

      setIsPlaylistModalOpen(false)
      setInfoMessage(`Added "${playlistSelection.itemTitle}" to playlist.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add song to playlist.'
      setPlaylistErrorMessage(message)
    } finally {
      setIsPlaylistSubmitting(false)
    }
  }

  const handleSaveCurrentSection = async () => {
    if (!workspace) {
      return
    }

    setErrorMessage(null)
    setInfoMessage(null)
    setIsSaving(true)

    try {
      const score = parseScoreInput(activeDraft.scoreInput)

      if (activeSectionKey === CONCLUSION_KEY) {
        await upsertConclusionSectionForCurrentUser({
          userSavedAlbumId: workspace.userSavedAlbumId,
          notes: activeDraft.notes,
          score,
        })
      } else {
        const trackNumber = parseTrackNumberFromKey(activeSectionKey)
        if (!trackNumber) {
          throw new Error('Invalid track selection.')
        }

        await upsertTrackReviewSectionForCurrentUser({
          userSavedAlbumId: workspace.userSavedAlbumId,
          trackNumber,
          isInterlude: activeDraft.isInterlude,
          notes: activeDraft.notes,
          score,
        })
      }

      const normalizedDraft: SectionDraft = {
        notes: activeDraft.notes,
        scoreInput: score === null ? '' : String(score),
        isInterlude: activeTrack ? activeDraft.isInterlude : false,
      }

      setDraftBySection((previous) => ({
        ...previous,
        [activeSectionKey]: normalizedDraft,
      }))

      setSavedBySection((previous) => ({
        ...previous,
        [activeSectionKey]: normalizedDraft,
      }))

      setInfoMessage('Saved.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save section.'
      setErrorMessage(message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen px-6 py-8">
        <div className="mx-auto w-full max-w-6xl">
          <LinearBackButton />
          <p className="mt-6 rounded-lg bg-white px-4 py-3 text-sm text-slate-700">
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

          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {errorMessage ?? 'Could not load this album review.'}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto w-full max-w-[1500px]">
        <LinearBackButton />

        <section className="mt-6 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="aspect-square w-full overflow-hidden rounded-lg bg-slate-200">
                <AlbumCover src={workspace.album.coverUrl} alt={`${workspace.album.title} cover`} loading="eager" />
              </div>
              <h1 className="mt-3 text-base font-bold text-slate-900">{workspace.album.title}</h1>
              <p className="text-sm text-slate-700">{workspace.album.artistName}</p>
              <button
                type="button"
                onClick={() =>
                  openRecommendationModal({
                    recommendationType: 'album',
                    itemTitle: workspace.album.title,
                    artistName: workspace.album.artistName,
                  })
                }
                className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
              >
                Recommend this album to a friend?
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Tracklist</p>
              <div className="max-h-[60vh] space-y-1 overflow-auto pr-1">
                {workspace.tracks.map((track) => {
                  const key = toTrackKey(track.trackNumber)
                  const isActive = key === activeSectionKey

                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => {
                        setActiveSectionKey(key)
                        setInfoMessage(null)
                        setErrorMessage(null)
                      }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                        isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                      }`}
                    >
                      <span className="mr-2 font-semibold">{track.trackNumber}.</span>
                      {track.title}
                    </button>
                  )
                })}

                <button
                  type="button"
                  onClick={() => {
                    setActiveSectionKey(CONCLUSION_KEY)
                    setInfoMessage(null)
                    setErrorMessage(null)
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold ${
                    activeSectionKey === CONCLUSION_KEY
                      ? 'bg-slate-900 text-white'
                      : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                  }`}
                >
                  Conclusion
                </button>
              </div>
            </div>
          </aside>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Review Section</p>
                <h2 className="text-lg font-bold text-slate-900">
                  {activeTrack ? `${activeTrack.trackNumber}. ${activeTrack.title}` : 'Conclusion'}
                </h2>
              </div>

              <label className="text-sm font-semibold text-slate-700">
                Score / 10
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={activeDraft.scoreInput}
                  onChange={(event) => handleScoreChange(event.target.value)}
                  className="mt-1 block w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
            </div>

            {activeTrack && (
              <label className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={activeDraft.isInterlude}
                  onChange={(event) => handleInterludeChange(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Mark as interlude
              </label>
            )}

            <textarea
              value={activeDraft.notes}
              onChange={(event) => handleNotesChange(event.target.value)}
              placeholder={activeTrack ? 'Write your notes for this track...' : 'Write your final album thoughts...'}
              className="h-[62vh] w-full resize-none rounded-lg border border-slate-300 p-3 text-sm leading-relaxed text-slate-900"
            />

            <div className="mt-3 flex items-center gap-3">
              {activeTrack && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      openRecommendationModal({
                        recommendationType: 'song',
                        itemTitle: activeTrack.title,
                        artistName: workspace.album.artistName,
                      })
                    }
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
                  >
                    Recommend this song to a friend?
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openPlaylistModal({
                        trackNumber: activeTrack.trackNumber,
                        itemTitle: activeTrack.title,
                        artistName: workspace.album.artistName,
                      })
                    }
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
                  >
                    Add this song to a playlist
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => void handleSaveCurrentSection()}
                disabled={isSaving || !isDirty}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>

              {isDirty && !isSaving && <p className="text-xs text-amber-700">Unsaved changes</p>}
              {!isDirty && <p className="text-xs text-slate-500">All changes saved</p>}
            </div>

            {errorMessage && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            )}

            {infoMessage && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                {infoMessage}
              </div>
            )}
          </section>

          <aside className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lyrics</p>
            {activeTrack ? (
              activeTrack.lyrics.trim() ? (
                <pre className="mt-2 max-h-[72vh] overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                  {activeTrack.lyrics}
                </pre>
              ) : (
                <p className="mt-2 text-sm text-slate-600">No lyrics stored for this track.</p>
              )
            ) : (
              <p className="mt-2 text-sm text-slate-600">Conclusion has no lyrics.</p>
            )}
          </aside>
        </section>
      </div>

      {isRecommendationModalOpen && workspace && recommendationItemTitle && recommendationArtistName && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
          onClick={() => {
            if (!isRecommendationSubmitting) {
              setIsRecommendationModalOpen(false)
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="recommend-track-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="recommend-track-title" className="text-lg font-bold text-slate-900">
              {recommendationType === 'album'
                ? 'Recommend this album to a friend?'
                : 'Recommend this song to a friend?'}
            </h2>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{recommendationItemTitle}</p>
              <p className="mt-1 text-sm text-slate-700">{recommendationArtistName}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {recommendationType === 'album' ? 'Album' : 'Song'}
              </p>
            </div>

            <label className="mt-4 block text-sm font-semibold text-slate-800">
              Send To
              <select
                value={selectedRecommendationFriendUserId}
                onChange={(event) => setSelectedRecommendationFriendUserId(event.target.value)}
                disabled={friends.length === 0 || isRecommendationSubmitting}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {friends.length === 0 && <option value="">No friends available</option>}
                {friends.map((friend) => (
                  <option key={friend.userId} value={friend.userId}>
                    {getFriendDisplayName(friend)}
                  </option>
                ))}
              </select>
            </label>

            {friends.length === 0 && (
              <p className="mt-3 text-sm text-slate-700">Add a friend first to send recommendations.</p>
            )}

            {recommendationErrorMessage && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {recommendationErrorMessage}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRecommendationModalOpen(false)}
                disabled={isRecommendationSubmitting}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSendRecommendation()}
                disabled={isRecommendationSubmitting || friends.length === 0}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isRecommendationSubmitting ? 'Sending...' : 'Send Recommendation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isPlaylistModalOpen && workspace && playlistSelection && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
          onClick={() => {
            if (!isPlaylistSubmitting) {
              setIsPlaylistModalOpen(false)
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-to-playlist-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="add-to-playlist-title" className="text-lg font-bold text-slate-900">
              Add this song to a playlist?
            </h2>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{playlistSelection.itemTitle}</p>
              <p className="mt-1 text-sm text-slate-700">{playlistSelection.artistName}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Song</p>
            </div>

            <label className="mt-4 block text-sm font-semibold text-slate-800">
              Playlist
              <select
                value={selectedPlaylistId}
                onChange={(event) => setSelectedPlaylistId(event.target.value)}
                disabled={playlists.length === 0 || isPlaylistSubmitting}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {playlists.length === 0 && <option value="">No playlists available</option>}
                {playlists.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.name}
                  </option>
                ))}
              </select>
            </label>

            {playlists.length === 0 && (
              <p className="mt-3 text-sm text-slate-700">
                Create a playlist first from My Stuff {'>'} Playlists.
              </p>
            )}

            {playlistErrorMessage && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {playlistErrorMessage}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPlaylistModalOpen(false)}
                disabled={isPlaylistSubmitting}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleAddSongToPlaylist()}
                disabled={isPlaylistSubmitting || playlists.length === 0}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isPlaylistSubmitting ? 'Adding...' : 'Add to Playlist'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default AlbumReviewPage
