import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import AlbumCover from '../components/AlbumCover'
import LinearBackButton from '../components/LinearBackButton'
import { useAlbumAccent } from '../hooks/useAlbumAccent'
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
  notesLyrically: string
  notesSonically: string
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
  notesLyrically: '',
  notesSonically: '',
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
        notesLyrically: section.notesLyrically,
        notesSonically: section.notesSonically,
        scoreInput: section.score === null ? '' : String(section.score),
        isInterlude: section.isInterlude,
      }
      continue
    }

    if (section.sectionType === 'conclusion') {
      map[CONCLUSION_KEY] = {
        notesLyrically: section.notesLyrically,
        notesSonically: section.notesSonically,
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
  const [activeNotesTab, setActiveNotesTab] = useState<'lyrically' | 'sonically'>('lyrically')
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
  const activeTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingAll, setIsSavingAll] = useState(false)
  const [showSavedMark, setShowSavedMark] = useState(false)
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false)
  const actionsMenuRef = useRef<HTMLDivElement | null>(null)
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false)
  const tagPopoverRef = useRef<HTMLDivElement | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [quoteModeEnabled, setQuoteModeEnabled] = useState(false)

  const accentColor = useAlbumAccent(workspace?.album.coverUrl)

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

  const handleSaveCurrentSectionRef = useRef<() => Promise<void>>(() => Promise.resolve())

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 's') {
        event.preventDefault()
        handleSaveCurrentSectionRef.current()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const activeDraft = draftBySection[activeSectionKey] ?? defaultDraft()
  const activeSavedDraft = savedBySection[activeSectionKey] ?? defaultDraft()
  const isDirty =
    activeDraft.notesLyrically !== activeSavedDraft.notesLyrically ||
    activeDraft.notesSonically !== activeSavedDraft.notesSonically ||
    activeDraft.scoreInput !== activeSavedDraft.scoreInput ||
    activeDraft.isInterlude !== activeSavedDraft.isInterlude

  const isDirtyForSection = (key: string): boolean => {
    const draft = draftBySection[key]
    const saved = savedBySection[key]
    if (!draft || !saved) return false
    return (
      draft.notesLyrically !== saved.notesLyrically ||
      draft.notesSonically !== saved.notesSonically ||
      draft.scoreInput !== saved.scoreInput ||
      draft.isInterlude !== saved.isInterlude
    )
  }

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

  const handleQuoteLine = (line: string) => {
    const tab = activeSectionKey === CONCLUSION_KEY ? 'lyrically' : activeNotesTab
    const currentValue = tab === 'lyrically' ? activeDraft.notesLyrically : activeDraft.notesSonically
    const separator = currentValue && !currentValue.endsWith('\n') ? '\n' : ''
    const newValue = currentValue + separator + `"${line}"\n`
    handleNotesChange(tab, newValue)

    requestAnimationFrame(() => {
      const textarea = activeTextareaRef.current
      if (!textarea) return
      textarea.focus()
      textarea.setSelectionRange(newValue.length, newValue.length)
      textarea.scrollTop = textarea.scrollHeight
    })
  }

  const handleNotesChange = (tab: 'lyrically' | 'sonically', value: string) => {
    setDraftBySection((previous) => ({
      ...previous,
      [activeSectionKey]: {
        ...(previous[activeSectionKey] ?? defaultDraft()),
        ...(tab === 'lyrically' ? { notesLyrically: value } : { notesSonically: value }),
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
          notesLyrically: activeDraft.notesLyrically,
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
          notesLyrically: activeDraft.notesLyrically,
          notesSonically: activeDraft.notesSonically,
          score,
        })
      }

      const normalizedDraft: SectionDraft = {
        notesLyrically: activeDraft.notesLyrically,
        notesSonically: activeDraft.notesSonically,
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
  handleSaveCurrentSectionRef.current = handleSaveCurrentSection

  const handleSaveAllSections = async () => {
    if (!workspace) {
      return
    }

    setErrorMessage(null)
    setInfoMessage(null)
    setIsSavingAll(true)

    try {
      const results = await Promise.all(
        workspace.tracks.map(async (track) => {
          const key = toTrackKey(track.trackNumber)
          const draft = draftBySection[key] ?? defaultDraft()
          const score = parseScoreInput(draft.scoreInput)

          await upsertTrackReviewSectionForCurrentUser({
            userSavedAlbumId: workspace.userSavedAlbumId,
            trackNumber: track.trackNumber,
            isInterlude: draft.isInterlude,
            notesLyrically: draft.notesLyrically,
            notesSonically: draft.notesSonically,
            score,
          })

          const normalizedDraft: SectionDraft = {
            notesLyrically: draft.notesLyrically,
            notesSonically: draft.notesSonically,
            scoreInput: score === null ? '' : String(score),
            isInterlude: draft.isInterlude,
          }

          return { key, normalizedDraft }
        })
      )

      setDraftBySection((previous) => {
        const next = { ...previous }
        for (const { key, normalizedDraft } of results) {
          next[key] = normalizedDraft
        }
        return next
      })

      setSavedBySection((previous) => {
        const next = { ...previous }
        for (const { key, normalizedDraft } of results) {
          next[key] = normalizedDraft
        }
        return next
      })

      setShowSavedMark(true)
      setTimeout(() => setShowSavedMark(false), 2000)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save all sections.'
      setErrorMessage(message)
    } finally {
      setIsSavingAll(false)
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

  const accentStyle = accentColor
    ? ({
        '--accent-h': accentColor.h,
        '--accent-s': `${accentColor.s}%`,
        '--accent-l': `${accentColor.l}%`,
      } as React.CSSProperties)
    : undefined

  return (
    <main className="flex h-screen flex-col overflow-hidden px-6 py-4" style={accentStyle}>
      <div className="mx-auto flex min-h-0 w-full max-w-[2400px] flex-1 flex-col">
        <LinearBackButton className="self-start" />

        <section className="mt-4 grid min-h-0 flex-1 gap-4 lg:grid-cols-[clamp(240px,18%,500px)_minmax(0,1fr)_clamp(280px,21%,560px)]">
          <aside className="flex min-h-0 flex-col gap-3">
            <div className="pb-1">
              <div className="aspect-square w-full overflow-hidden rounded-xl bg-surface-2 accent-art-shadow">
                <AlbumCover src={workspace.album.coverUrl} alt={`${workspace.album.title} cover`} loading="eager" />
              </div>
              <h1 className="mt-3 px-1 text-base font-bold text-ink">{workspace.album.title}</h1>
              <div className="flex items-center justify-between gap-2 px-1">
                <p className="text-sm text-[#a78bfa]">{workspace.album.artistName}</p>
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

            <div className="flex min-h-0 flex-1 flex-col">
              <p className="pb-2 pl-1 text-xs font-semibold uppercase tracking-wide text-[#a78bfa]">Tracklist</p>
              <div className="min-h-0 flex-1 overflow-auto pr-1">
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
                      style={isActive ? { borderLeftColor: 'hsl(var(--accent-h) var(--accent-s) var(--accent-l))' } : undefined}
                      className={`flex w-full items-center gap-2.5 border-l-2 py-1.5 pl-2 pr-2 text-left text-sm transition-all ${
                        isActive ? 'track-item-active text-white' : 'border-l-transparent text-ink-2 hover:border-l-edge hover:text-ink'
                      }`}
                    >
                      <span className={`w-5 shrink-0 text-right text-[11px] font-bold tabular-nums leading-none ${
                        isActive ? 'text-white/70' : 'text-ink-3'
                      }`}>
                        {track.trackNumber}
                      </span>
                      <span className="flex-1 truncate">{track.title}</span>
                      {!isActive && isDirtyForSection(key) && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-label="Unsaved changes" />
                      )}
                    </button>
                  )
                })}

                <div className="mt-1 border-t border-edge/30 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSectionKey(CONCLUSION_KEY)
                      setInfoMessage(null)
                      setErrorMessage(null)
                    }}
                    className={`flex w-full items-center gap-2.5 border-l-2 py-1.5 pl-2 pr-2 text-left text-sm font-semibold transition-all ${
                      activeSectionKey === CONCLUSION_KEY
                        ? 'border-l-pink text-white'
                        : 'border-l-transparent text-pink hover:border-l-pink/50 hover:text-pink'
                    }`}
                  >
                    <span className={`shrink-0 text-[11px] font-bold leading-none ${
                      activeSectionKey === CONCLUSION_KEY ? 'text-white/70' : 'text-pink/70'
                    }`}>
                      ★
                    </span>
                    <span className="flex-1">Conclusion</span>
                    {activeSectionKey !== CONCLUSION_KEY && isDirtyForSection(CONCLUSION_KEY) && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-label="Unsaved changes" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <section className="writing-panel flex min-h-0 flex-col rounded-xl border border-edge p-4">
            <div className="mb-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h2 className="text-2xl font-bold leading-tight text-ink">
                  {activeTrack ? (
                    <>
                      <span
                        className="mr-1.5 text-sm font-semibold tabular-nums"
                        style={{ color: 'hsl(var(--accent-h) var(--accent-s) var(--accent-l) / 0.7)' }}
                      >
                        {activeTrack.trackNumber}.
                      </span>
                      {activeTrack.title}
                    </>
                  ) : (
                    'Conclusion'
                  )}
                </h2>

                <div className="flex shrink-0 items-center gap-2">
                {showSavedMark && (
                  <span className="accent-badge rounded-full border px-2 py-0.5 text-xs font-semibold">
                    Saved ✓
                  </span>
                )}
                {isDirty && !isSaving && (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">
                    Unsaved
                  </span>
                )}

                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Score</span>
                  <div className="flex items-baseline gap-1">
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={activeDraft.scoreInput}
                      onChange={(event) => handleScoreChange(event.target.value)}
                      placeholder="—"
                      className="score-input"
                    />
                    <span className="text-sm font-semibold text-ink-3">/10</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleSaveCurrentSection()}
                  disabled={isSaving || isSavingAll || !isDirty}
                  className="btn-gradient-cta rounded-lg px-4 py-2 text-sm font-semibold text-white"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveAllSections()}
                  disabled={isSaving || isSavingAll}
                  className="rounded-lg border border-edge/70 bg-transparent px-3 py-2 text-xs font-semibold text-ink-3 hover:border-edge hover:text-ink disabled:opacity-50"
                >
                  {isSavingAll ? 'Saving all...' : 'Save all'}
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
                    <div className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-edge bg-gradient-to-b from-[#141028] to-[#0e0c1c] p-1 shadow-lg">
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
            <div
              className="h-[2px] rounded-full"
              style={{
                background: activeTrack
                  ? 'linear-gradient(to right, hsl(var(--accent-h) var(--accent-s) var(--accent-l) / 0.7), hsl(var(--accent-h) var(--accent-s) var(--accent-l) / 0.12) 65%, transparent)'
                  : 'linear-gradient(to right, rgba(219, 39, 119, 0.7), rgba(219, 39, 119, 0.12) 65%, transparent)',
              }}
            />
            </div>

            <div className="mb-3 flex items-center gap-3">
              {activeTrack && (
                <div className="flex rounded-full bg-surface-3 p-1 text-sm font-semibold">
                  <button
                    type="button"
                    onClick={() => setActiveNotesTab('lyrically')}
                    className={`rounded-full px-4 py-1 transition-all ${activeNotesTab === 'lyrically' ? 'tab-btn-active accent-tab-glow text-white' : 'text-ink-2 hover:text-ink'}`}
                  >
                    Lyrically
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveNotesTab('sonically')}
                    className={`rounded-full px-4 py-1 transition-all ${activeNotesTab === 'sonically' ? 'tab-btn-active accent-tab-glow text-white' : 'text-ink-2 hover:text-ink'}`}
                  >
                    Sonically
                  </button>
                </div>
              )}

              {activeTrack && (
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                  <input
                    type="checkbox"
                    checked={activeDraft.isInterlude}
                    onChange={(event) => handleInterludeChange(event.target.checked)}
                    className="h-4 w-4 rounded border-edge"
                  />
                  Mark as interlude
                </label>
              )}
            </div>

            {activeTrack ? (
              <textarea
                key={`${activeSectionKey}-${activeNotesTab}`}
                ref={activeTextareaRef}
                value={activeNotesTab === 'lyrically' ? activeDraft.notesLyrically : activeDraft.notesSonically}
                onChange={(event) => handleNotesChange(activeNotesTab, event.target.value)}
                style={{ borderLeftColor: 'hsl(var(--accent-h) var(--accent-s) var(--accent-l) / 0.5)' }}
                className="min-h-0 flex-1 w-full resize-none rounded-lg border border-edge border-l-2 p-3 text-sm leading-relaxed text-ink"
              />
            ) : (
              <textarea
                ref={activeTextareaRef}
                value={activeDraft.notesLyrically}
                onChange={(event) => handleNotesChange('lyrically', event.target.value)}
                className="min-h-0 flex-1 w-full resize-none rounded-lg border border-edge border-l-2 border-l-pink/50 p-3 text-sm leading-relaxed text-ink"
              />
            )}

            {activeTrack && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {(tagsByTrack[activeTrack.trackNumber] ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full tag-pill px-3 py-1 text-xs font-semibold"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => void handleRemoveTag(tag)}
                      className="ml-1 text-ink-3 hover:text-[#6ee7b7]"
                      aria-label={`Remove tag ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <div hidden ref={tagPopoverRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsTagPopoverOpen((prev) => !prev)}
                    className="tag-add-btn inline-flex items-center gap-1 rounded-full border border-dashed border-edge px-3 py-1 text-xs font-semibold text-ink-3 transition-colors"
                  >
                    + Tag
                  </button>
                  {isTagPopoverOpen && (
                    <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-xl border border-edge bg-gradient-to-b from-[#141028] to-[#0e0c1c] p-3 shadow-lg">
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
                          className="btn-gradient-cta rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
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

          <aside className="flex min-h-0 flex-col rounded-xl border border-edge/60 bg-gradient-to-b from-[#0e0c1c] to-[#090710] p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#a78bfa]">Lyrics</p>
              {activeTrack && !isEditingLyrics && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuoteModeEnabled((prev) => !prev)}
                    title={quoteModeEnabled ? 'Click-to-quote: on' : 'Click-to-quote: off'}
                    className={`rounded px-1.5 text-sm font-bold leading-none transition-all ${quoteModeEnabled ? 'quote-active' : 'text-ink-3 hover:text-ink'}`}
                    aria-label={quoteModeEnabled ? 'Disable click-to-quote' : 'Enable click-to-quote'}
                  >
                    "
                  </button>
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
                      <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-lg border border-edge bg-gradient-to-b from-[#141028] to-[#0e0c1c] shadow-lg">
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
                      className="btn-gradient-cta rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
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
                    {quoteModeEnabled ? (
                      <div className="text-sm leading-relaxed text-ink">
                        {displayed.split('\n').map((line, index) =>
                          line.trim() ? (
                            <button
                              key={index}
                              type="button"
                              onClick={() => handleQuoteLine(line)}
                              className="lyric-quote-line block w-full rounded px-1 py-0.5 text-left"
                            >
                              {line}
                            </button>
                          ) : (
                            <div key={index} className="h-3" />
                          )
                        )}
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                        {displayed}
                      </pre>
                    )}
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
            className="w-full max-w-md rounded-xl border border-edge bg-gradient-to-b from-[#141028] to-[#0e0c1c] p-5 shadow-xl"
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
                className="btn-gradient-cta rounded-lg px-4 py-2 text-sm font-semibold text-white"
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
            className="w-full max-w-md rounded-xl border border-edge bg-gradient-to-b from-[#141028] to-[#0e0c1c] p-5 shadow-xl"
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
