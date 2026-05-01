import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import AlbumCover from '../components/AlbumCover'
import LinearBackButton from '../components/LinearBackButton'
import { getFriendsOverviewForCurrentUser, type FriendProfile } from '../lib/db/friendsData'
import {
  getAlbumWorkspaceForCurrentUser,
  updateTrackLyrics,
  upsertConclusionSectionForCurrentUser,
  upsertTrackReviewSectionForCurrentUser,
  type AlbumWorkspace,
} from '../lib/db/reviewsData'
// import {
//   addSongToPlaylistForCurrentUser,
//   listPlaylistOptionsForCurrentUser,
//   type PlaylistOption,
// } from '../lib/db/playlistsData'
import { sendRecommendationForCurrentUser, type RecommendationType } from '../lib/db/toListenData'
import { addTagForCurrentUser, listTagsForAlbum, removeTagForCurrentUser } from '../lib/db/tagsData'
import {
  deleteLyricsOverrideForCurrentUser,
  listLyricsOverridesForAlbum,
  saveLyricsOverrideForCurrentUser,
} from '../lib/db/lyricsData'
import { getLyricsAsync } from '../lib/external/geniusLyrics'

type SectionDraft = {
  notes: string
  scoreInput: string
  isInterlude: boolean
}

type DraftMap = Record<string, SectionDraft>
// type PlaylistSelection = {
//   trackNumber: number
//   itemTitle: string
//   artistName: string
// }

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
  // const [playlists, setPlaylists] = useState<PlaylistOption[]>([])
  // const [selectedPlaylistId, setSelectedPlaylistId] = useState('')
  // const [playlistSelection, setPlaylistSelection] = useState<PlaylistSelection | null>(null)
  // const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false)
  // const [isPlaylistSubmitting, setIsPlaylistSubmitting] = useState(false)
  // const [playlistErrorMessage, setPlaylistErrorMessage] = useState<string | null>(null)
  const [activeSectionKey, setActiveSectionKey] = useState<string>(CONCLUSION_KEY)
  const [trackNameCopied, setTrackNameCopied] = useState(false)
  const [draftBySection, setDraftBySection] = useState<DraftMap>({})
  const [savedBySection, setSavedBySection] = useState<DraftMap>({})
  const [tagsByTrack, setTagsByTrack] = useState<Record<number, string[]>>({})
  const [tagInput, setTagInput] = useState('')
  const [isTagSaving, setIsTagSaving] = useState(false)
  const [tagErrorMessage, setTagErrorMessage] = useState<string | null>(null)
  const [lyricsOverrideByTrack, setLyricsOverrideByTrack] = useState<Record<number, string>>({})
  const [isEditingLyrics, setIsEditingLyrics] = useState(false)
  const [lyricsEditText, setLyricsEditText] = useState('')
  const [isSavingLyrics, setIsSavingLyrics] = useState(false)
  const [lyricsErrorMessage, setLyricsErrorMessage] = useState<string | null>(null)
  const [isLyricsMenuOpen, setIsLyricsMenuOpen] = useState(false)
  const [isRefetchingLyrics, setIsRefetchingLyrics] = useState(false)
  const lyricsMenuRef = useRef<HTMLDivElement | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showSavedMark, setShowSavedMark] = useState(false)
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false)
  const actionsMenuRef = useRef<HTMLDivElement | null>(null)
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false)
  const tagPopoverRef = useRef<HTMLDivElement | null>(null)
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
        const [loadedWorkspace, friendsOverview, /* playlistOptions, */ loadedTags, loadedLyricsOverrides] = await Promise.all([
          getAlbumWorkspaceForCurrentUser(userSavedAlbumId),
          getFriendsOverviewForCurrentUser(),
          // listPlaylistOptionsForCurrentUser(),
          listTagsForAlbum(userSavedAlbumId),
          listLyricsOverridesForAlbum(userSavedAlbumId),
        ])

        if (!isActive) {
          return
        }

        setFriends(friendsOverview.friends)
        setSelectedRecommendationFriendUserId(
          (previous) => previous || friendsOverview.friends[0]?.userId || '',
        )
        // setPlaylists(playlistOptions)
        // setSelectedPlaylistId((previous) => previous || playlistOptions[0]?.id || '')

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
        setTagsByTrack(loadedTags)
        setLyricsOverrideByTrack(loadedLyricsOverrides)
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

  useEffect(() => {
    if (!isActionsMenuOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) {
        return
      }
      if (!actionsMenuRef.current?.contains(event.target)) {
        setIsActionsMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsActionsMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isActionsMenuOpen])

  useEffect(() => {
    if (!isTagPopoverOpen) {
      setTagInput('')
      setTagErrorMessage(null)
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) {
        return
      }
      if (!tagPopoverRef.current?.contains(event.target)) {
        setIsTagPopoverOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsTagPopoverOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isTagPopoverOpen])

  useEffect(() => {
    if (!isLyricsMenuOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) {
        return
      }
      if (!lyricsMenuRef.current?.contains(event.target)) {
        setIsLyricsMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLyricsMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isLyricsMenuOpen])

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
    setRecommendationType(params.recommendationType)
    setRecommendationItemTitle(params.itemTitle)
    setRecommendationArtistName(params.artistName)
    setIsRecommendationModalOpen(true)
  }

  // const openPlaylistModal = (selection: PlaylistSelection) => {
  //   setPlaylistErrorMessage(null)
  //   setIsRecommendationModalOpen(false)
  //   setPlaylistSelection(selection)
  //   setIsPlaylistModalOpen(true)
  // }

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

  // const handleAddSongToPlaylist = async () => {
  //   if (!workspace || !playlistSelection) {
  //     return
  //   }
  //
  //   setPlaylistErrorMessage(null)
  //   setInfoMessage(null)
  //   setIsPlaylistSubmitting(true)
  //
  //   try {
  //     await addSongToPlaylistForCurrentUser({
  //       playlistId: selectedPlaylistId,
  //       userSavedAlbumId: workspace.userSavedAlbumId,
  //       trackNumber: playlistSelection.trackNumber,
  //     })
  //
  //     setIsPlaylistModalOpen(false)
  //     setInfoMessage(`Added "${playlistSelection.itemTitle}" to playlist.`)
  //   } catch (error) {
  //     const message = error instanceof Error ? error.message : 'Failed to add song to playlist.'
  //     setPlaylistErrorMessage(message)
  //   } finally {
  //     setIsPlaylistSubmitting(false)
  //   }
  // }

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

      setShowSavedMark(true)
      setTimeout(() => setShowSavedMark(false), 2000)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save section.'
      setErrorMessage(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveLyrics = async () => {
    if (!workspace || !activeTrack) {
      return
    }

    setLyricsErrorMessage(null)
    setIsSavingLyrics(true)

    try {
      if (lyricsEditText === activeTrack.lyrics) {
        // Matches original — delete any existing override
        await deleteLyricsOverrideForCurrentUser(workspace.userSavedAlbumId, activeTrack.trackNumber)
        setLyricsOverrideByTrack((previous) => {
          const next = { ...previous }
          delete next[activeTrack.trackNumber]
          return next
        })
      } else {
        await saveLyricsOverrideForCurrentUser(
          workspace.userSavedAlbumId,
          activeTrack.trackNumber,
          lyricsEditText,
        )
        setLyricsOverrideByTrack((previous) => ({
          ...previous,
          [activeTrack.trackNumber]: lyricsEditText,
        }))
      }

      setIsEditingLyrics(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save lyrics.'
      setLyricsErrorMessage(message)
    } finally {
      setIsSavingLyrics(false)
    }
  }

  const handleRevertLyrics = async () => {
    if (!workspace || !activeTrack) {
      return
    }

    setLyricsErrorMessage(null)
    setIsSavingLyrics(true)

    try {
      await deleteLyricsOverrideForCurrentUser(workspace.userSavedAlbumId, activeTrack.trackNumber)
      setLyricsOverrideByTrack((previous) => {
        const next = { ...previous }
        delete next[activeTrack.trackNumber]
        return next
      })
      setIsEditingLyrics(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to revert lyrics.'
      setLyricsErrorMessage(message)
    } finally {
      setIsSavingLyrics(false)
    }
  }

  const handleRefetchLyrics = async () => {
    if (!workspace || !activeTrack) {
      return
    }

    setIsLyricsMenuOpen(false)
    setIsRefetchingLyrics(true)
    setLyricsErrorMessage(null)

    try {
      const artistName = workspace.album.artistNames[0] ?? workspace.album.artistName
      const newLyrics = await getLyricsAsync(activeTrack.title, artistName)
      await updateTrackLyrics(activeTrack.id, newLyrics)
      // Clear any user override so the updated base lyrics are shown
      await deleteLyricsOverrideForCurrentUser(workspace.userSavedAlbumId, activeTrack.trackNumber)
      setLyricsOverrideByTrack((previous) => {
        const next = { ...previous }
        delete next[activeTrack.trackNumber]
        return next
      })
      setWorkspace((previous) => {
        if (!previous) {
          return previous
        }
        return {
          ...previous,
          tracks: previous.tracks.map((t) =>
            t.id === activeTrack.id ? { ...t, lyrics: newLyrics } : t,
          ),
        }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to re-fetch lyrics.'
      setLyricsErrorMessage(message)
    } finally {
      setIsRefetchingLyrics(false)
    }
  }

  const handleAddTag = async (): Promise<boolean> => {
    if (!workspace || !activeTrack) {
      return false
    }

    const normalized = tagInput.trim().toLowerCase()
    if (!normalized) {
      return false
    }

    setTagErrorMessage(null)
    setIsTagSaving(true)

    try {
      await addTagForCurrentUser(workspace.userSavedAlbumId, activeTrack.trackNumber, normalized)
      setTagsByTrack((previous) => {
        const existing = previous[activeTrack.trackNumber] ?? []
        if (existing.includes(normalized)) {
          return previous
        }
        return { ...previous, [activeTrack.trackNumber]: [...existing, normalized] }
      })
      setTagInput('')
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add tag.'
      setTagErrorMessage(message)
      return false
    } finally {
      setIsTagSaving(false)
    }
  }

  const handleRemoveTag = async (tag: string) => {
    if (!workspace || !activeTrack) {
      return
    }

    setTagErrorMessage(null)

    try {
      await removeTagForCurrentUser(workspace.userSavedAlbumId, activeTrack.trackNumber, tag)
      setTagsByTrack((previous) => ({
        ...previous,
        [activeTrack.trackNumber]: (previous[activeTrack.trackNumber] ?? []).filter((t) => t !== tag),
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove tag.'
      setTagErrorMessage(message)
    }
  }

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

          <div className="mt-6 rounded-lg border border-err-edge bg-err-bg p-4 text-sm text-err">
            {errorMessage ?? 'Could not load this album review.'}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden px-6 py-4">
      <div className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 flex-col">
        <LinearBackButton className="self-start" />

        <section className="mt-4 grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className="flex min-h-0 flex-col gap-4">
            <div className="rounded-xl border border-edge bg-surface p-4">
              <div className="aspect-square w-full overflow-hidden rounded-lg bg-surface-2">
                <AlbumCover src={workspace.album.coverUrl} alt={`${workspace.album.title} cover`} loading="eager" />
              </div>
              <h1 className="mt-3 text-base font-bold text-ink">{workspace.album.title}</h1>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-ink">{workspace.album.artistName}</p>
                {activeTrack && (
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        `${activeTrack.title} by ${workspace.album.artistName}`,
                      )
                      setTrackNameCopied(true)
                      setTimeout(() => setTrackNameCopied(false), 1500)
                    }}
                    className={trackNameCopied ? 'text-green-500' : 'text-ink-3 hover:text-ink'}
                    aria-label="Copy song and artist name"
                  >
                    {trackNameCopied ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                        <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                        <path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-edge bg-surface p-3">
              <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Tracklist</p>
              <div className="min-h-0 flex-1 space-y-1 overflow-auto pr-1">
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
                  onClick={() => {
                    setActiveSectionKey(CONCLUSION_KEY)
                    setInfoMessage(null)
                    setErrorMessage(null)
                  }}
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

          <section className="flex min-h-0 flex-col rounded-xl border border-edge bg-surface p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-ink">
                  {activeTrack ? `${activeTrack.trackNumber}. ${activeTrack.title}` : 'Conclusion'}
                </h2>
              </div>

              <div className="flex items-end gap-3">
                {showSavedMark && <span className="pb-1 text-lg text-ok">✓</span>}
                {isDirty && !isSaving && <p className="pb-1 text-xs text-warn">Unsaved changes</p>}
                {activeTrack && (
                  <div ref={tagPopoverRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setIsTagPopoverOpen((prev) => !prev)}
                      className="rounded-lg border border-edge bg-surface px-3 py-2 text-sm font-semibold text-ink hover:bg-surface-2"
                    >
                      Add a tag
                    </button>
                    {isTagPopoverOpen && (
                      <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-xl border border-edge bg-surface p-3 shadow-lg">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={tagInput}
                            onChange={(event) => setTagInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                void handleAddTag().then((ok) => { if (ok) setIsTagPopoverOpen(false) })
                              }
                            }}
                            placeholder="Tag name..."
                            maxLength={50}
                            autoFocus
                            className="flex-1 rounded-md border border-edge px-3 py-1.5 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => void handleAddTag().then((ok) => { if (ok) setIsTagPopoverOpen(false) })}
                            disabled={isTagSaving || !tagInput.trim()}
                            className="rounded-lg bg-cta px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            Add
                          </button>
                        </div>
                        {tagErrorMessage && (
                          <p className="mt-2 text-xs text-err">{tagErrorMessage}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <label className="text-sm font-semibold text-ink">
                  Score / 10
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    value={activeDraft.scoreInput}
                    onChange={(event) => handleScoreChange(event.target.value)}
                    className="mt-1 block w-24 rounded-md border border-edge px-2 py-1 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void handleSaveCurrentSection()}
                  disabled={isSaving || !isDirty}
                  className="rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <div ref={actionsMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsActionsMenuOpen((prev) => !prev)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-edge bg-surface text-ink hover:bg-surface-2"
                    aria-label="More actions"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                      <circle cx="12" cy="5" r="1.5" />
                      <circle cx="12" cy="12" r="1.5" />
                      <circle cx="12" cy="19" r="1.5" />
                    </svg>
                  </button>
                  {isActionsMenuOpen && (
                    <div className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-edge bg-surface p-1 shadow-lg">
                      {activeTrack && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsActionsMenuOpen(false)
                            openRecommendationModal({
                              recommendationType: 'song',
                              itemTitle: activeTrack.title,
                              artistName: workspace.album.artistName,
                            })
                          }}
                          className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-surface-2"
                        >
                          Recommend song to friend
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setIsActionsMenuOpen(false)
                          openRecommendationModal({
                            recommendationType: 'album',
                            itemTitle: workspace.album.title,
                            artistName: workspace.album.artistName,
                          })
                        }}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-surface-2"
                      >
                        Recommend album to friend
                      </button>
                      {/* {activeTrack && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsActionsMenuOpen(false)
                            openPlaylistModal({
                              trackNumber: activeTrack.trackNumber,
                              itemTitle: activeTrack.title,
                              artistName: workspace.album.artistName,
                            })
                          }}
                          className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-surface-2"
                        >
                          Add song to playlist
                        </button>
                      )} */}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {activeTrack && (
              <label className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={activeDraft.isInterlude}
                  onChange={(event) => handleInterludeChange(event.target.checked)}
                  className="h-4 w-4 rounded border-edge"
                />
                Mark as interlude
              </label>
            )}

            <textarea
              value={activeDraft.notes}
              onChange={(event) => handleNotesChange(event.target.value)}
              className="min-h-0 flex-1 w-full resize-none rounded-lg border border-edge p-3 text-sm leading-relaxed text-ink"
            />

            {activeTrack && (tagsByTrack[activeTrack.trackNumber] ?? []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {(tagsByTrack[activeTrack.trackNumber] ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-ink-2"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => void handleRemoveTag(tag)}
                      className="ml-1 text-ink-3 hover:text-ink"
                      aria-label={`Remove tag ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {errorMessage && (
              <div className="mt-3 rounded-lg border border-err-edge bg-err-bg p-3 text-sm text-err">
                {errorMessage}
              </div>
            )}

            {infoMessage && (
              <div className="mt-3 rounded-lg border border-ok-edge bg-ok-bg p-3 text-sm text-ok">
                {infoMessage}
              </div>
            )}
          </section>

          <aside className="flex min-h-0 flex-col rounded-xl border border-edge bg-surface p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Lyrics</p>
              {activeTrack && !isEditingLyrics && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const displayed = lyricsOverrideByTrack[activeTrack.trackNumber] ?? activeTrack.lyrics
                      setLyricsEditText(displayed)
                      setLyricsErrorMessage(null)
                      setIsEditingLyrics(true)
                    }}
                    className="text-xs font-semibold text-ink-3 hover:text-ink"
                  >
                    Edit
                  </button>
                  <div ref={lyricsMenuRef} className="relative">
                    <button
                      type="button"
                      disabled={isRefetchingLyrics}
                      onClick={() => setIsLyricsMenuOpen((open) => !open)}
                      className="flex h-5 w-5 items-center justify-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink disabled:opacity-40"
                      aria-label="Lyrics options"
                    >
                      {isRefetchingLyrics ? (
                        <span className="text-xs">...</span>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                          <circle cx="8" cy="2.5" r="1.5" />
                          <circle cx="8" cy="8" r="1.5" />
                          <circle cx="8" cy="13.5" r="1.5" />
                        </svg>
                      )}
                    </button>
                    {isLyricsMenuOpen && (
                      <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-lg border border-edge bg-surface shadow-lg">
                        <button
                          type="button"
                          onClick={() => void handleRefetchLyrics()}
                          className="w-full px-3 py-2 text-left text-xs text-ink hover:bg-surface-2"
                        >
                          Re-fetch lyrics
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {activeTrack ? (
              isEditingLyrics ? (
                <>
                  <textarea
                    value={lyricsEditText}
                    onChange={(event) => setLyricsEditText(event.target.value)}
                    className="min-h-0 flex-1 w-full resize-none rounded-lg border border-edge p-2 text-sm leading-relaxed text-ink"
                  />
                  {lyricsErrorMessage && (
                    <p className="mt-1 text-xs text-err">{lyricsErrorMessage}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveLyrics()}
                      disabled={isSavingLyrics}
                      className="rounded-lg bg-cta px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {isSavingLyrics ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingLyrics(false)}
                      disabled={isSavingLyrics}
                      className="rounded-lg border border-edge px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    {lyricsOverrideByTrack[activeTrack.trackNumber] !== undefined && (
                      <button
                        type="button"
                        onClick={() => void handleRevertLyrics()}
                        disabled={isSavingLyrics}
                        className="rounded-lg border border-err-edge px-3 py-1.5 text-xs font-semibold text-err hover:bg-err-bg disabled:opacity-60"
                      >
                        Revert to original
                      </button>
                    )}
                  </div>
                </>
              ) : (() => {
                const displayed = lyricsOverrideByTrack[activeTrack.trackNumber] ?? activeTrack.lyrics
                const hasOverride = lyricsOverrideByTrack[activeTrack.trackNumber] !== undefined
                return displayed.trim() ? (
                  <div className="min-h-0 flex-1 overflow-auto">
                    {hasOverride && (
                      <p className="mb-1 text-xs font-semibold text-ink-2">Edited</p>
                    )}
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                      {displayed}
                    </pre>
                  </div>
                ) : (
                  <p className="text-sm text-ink-2">No lyrics stored for this track.</p>
                )
              })()
            ) : (
              <p className="text-sm text-ink-2">Conclusion has no lyrics.</p>
            )}
          </aside>
        </section>
      </div>

      {isRecommendationModalOpen && workspace && recommendationItemTitle && recommendationArtistName && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
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
            className="w-full max-w-md rounded-xl border border-edge bg-surface p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="recommend-track-title" className="text-lg font-bold text-ink">
              {recommendationType === 'album'
                ? 'Recommend this album to a friend?'
                : 'Recommend this song to a friend?'}
            </h2>

            <div className="mt-4 rounded-lg border border-edge bg-surface-2 px-4 py-3">
              <p className="text-sm font-semibold text-ink">{recommendationItemTitle}</p>
              <p className="mt-1 text-sm text-ink">{recommendationArtistName}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-3">
                {recommendationType === 'album' ? 'Album' : 'Song'}
              </p>
            </div>

            <label className="mt-4 block text-sm font-semibold text-ink">
              Send To
              <select
                value={selectedRecommendationFriendUserId}
                onChange={(event) => setSelectedRecommendationFriendUserId(event.target.value)}
                disabled={friends.length === 0 || isRecommendationSubmitting}
                className="mt-1 w-full rounded-lg border border-edge px-3 py-2 text-sm"
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
              <p className="mt-3 text-sm text-ink">Add a friend first to send recommendations.</p>
            )}

            {recommendationErrorMessage && (
              <div className="mt-3 rounded-lg border border-err-edge bg-err-bg p-3 text-sm text-err">
                {recommendationErrorMessage}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRecommendationModalOpen(false)}
                disabled={isRecommendationSubmitting}
                className="rounded-lg border border-edge px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSendRecommendation()}
                disabled={isRecommendationSubmitting || friends.length === 0}
                className="rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isRecommendationSubmitting ? 'Sending...' : 'Send Recommendation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* {isPlaylistModalOpen && workspace && playlistSelection && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
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
            className="w-full max-w-md rounded-xl border border-edge bg-surface p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="add-to-playlist-title" className="text-lg font-bold text-ink">
              Add this song to a playlist?
            </h2>

            <div className="mt-4 rounded-lg border border-edge bg-surface-2 px-4 py-3">
              <p className="text-sm font-semibold text-ink">{playlistSelection.itemTitle}</p>
              <p className="mt-1 text-sm text-ink">{playlistSelection.artistName}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-3">Song</p>
            </div>

            <label className="mt-4 block text-sm font-semibold text-ink">
              Playlist
              <select
                value={selectedPlaylistId}
                onChange={(event) => setSelectedPlaylistId(event.target.value)}
                disabled={playlists.length === 0 || isPlaylistSubmitting}
                className="mt-1 w-full rounded-lg border border-edge px-3 py-2 text-sm"
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
              <p className="mt-3 text-sm text-ink">
                Create a playlist first from My Stuff {'>'} Playlists.
              </p>
            )}

            {playlistErrorMessage && (
              <div className="mt-3 rounded-lg border border-err-edge bg-err-bg p-3 text-sm text-err">
                {playlistErrorMessage}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPlaylistModalOpen(false)}
                disabled={isPlaylistSubmitting}
                className="rounded-lg border border-edge px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleAddSongToPlaylist()}
                disabled={isPlaylistSubmitting || playlists.length === 0}
                className="rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isPlaylistSubmitting ? 'Adding...' : 'Add to Playlist'}
              </button>
            </div>
          </div>
        </div>
      )} */}
    </main>
  )
}

export default AlbumReviewPage
