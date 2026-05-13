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
  if (!key.startsWith('track:')) return null
  const trackNumber = Number(key.replace('track:', ''))
  if (!Number.isInteger(trackNumber) || trackNumber <= 0) return null
  return trackNumber
}

const parseScoreInput = (scoreInput: string): number | null => {
  const trimmed = scoreInput.trim()
  if (!trimmed) return null
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

const formatDuration = (secs: number | null): string => {
  if (!secs || secs <= 0) return ''
  const total = Math.round(secs)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
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
  const [activeSectionKey, setActiveSectionKey] = useState<string>(CONCLUSION_KEY)
  const [activeNotesTab, setActiveNotesTab] = useState<'lyrically' | 'sonically'>('lyrically')
  const [draftBySection, setDraftBySection] = useState<DraftMap>({})
  const [savedBySection, setSavedBySection] = useState<DraftMap>({})
  const [_tagsByTrack, setTagsByTrack] = useState<Record<number, string[]>>({})
  const [tagInput, setTagInput] = useState('')
  const [_isTagSaving, setIsTagSaving] = useState(false)
  const [_tagErrorMessage, setTagErrorMessage] = useState<string | null>(null)
  const [lyricsOverrideByTrack, setLyricsOverrideByTrack] = useState<Record<number, string>>({})
  const [isEditingLyrics, setIsEditingLyrics] = useState(false)
  const [lyricsEditText, setLyricsEditText] = useState('')
  const [isSavingLyrics, setIsSavingLyrics] = useState(false)
  const [lyricsErrorMessage, setLyricsErrorMessage] = useState<string | null>(null)
  const [isLyricsMenuOpen, setIsLyricsMenuOpen] = useState(false)
  const [isRefetchingLyrics, setIsRefetchingLyrics] = useState(false)
  const lyricsMenuRef = useRef<HTMLDivElement | null>(null)
  const activeTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const scoreInputRef = useRef<HTMLInputElement | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingAll, setIsSavingAll] = useState(false)
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
        const [loadedWorkspace, friendsOverview, loadedTags, loadedLyricsOverrides] = await Promise.all([
          getAlbumWorkspaceForCurrentUser(userSavedAlbumId),
          getFriendsOverviewForCurrentUser(),
          listTagsForAlbum(userSavedAlbumId),
          listLyricsOverridesForAlbum(userSavedAlbumId),
        ])

        if (!isActive) return

        setFriends(friendsOverview.friends)
        setSelectedRecommendationFriendUserId(
          (previous) => previous || friendsOverview.friends[0]?.userId || '',
        )

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
        if (!isActive) return
        const message = error instanceof Error ? error.message : 'Failed to load review workspace.'
        setErrorMessage(message)
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    void loadWorkspace()
    return () => { isActive = false }
  }, [userSavedAlbumId])

  useEffect(() => {
    if (!isActionsMenuOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (!actionsMenuRef.current?.contains(event.target)) setIsActionsMenuOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsActionsMenuOpen(false)
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
      if (!(event.target instanceof Node)) return
      if (!tagPopoverRef.current?.contains(event.target)) setIsTagPopoverOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsTagPopoverOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isTagPopoverOpen])

  useEffect(() => {
    if (!isLyricsMenuOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (!lyricsMenuRef.current?.contains(event.target)) setIsLyricsMenuOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsLyricsMenuOpen(false)
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
    if (!workspace) return null
    const trackNumber = parseTrackNumberFromKey(activeSectionKey)
    if (!trackNumber) return null
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

  const handleSendRecommendation = async () => {
    if (!workspace || !recommendationItemTitle || !recommendationArtistName) return
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

  const handleSaveCurrentSection = async () => {
    if (!workspace) return
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
        if (!trackNumber) throw new Error('Invalid track selection.')
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
      setDraftBySection((previous) => ({ ...previous, [activeSectionKey]: normalizedDraft }))
      setSavedBySection((previous) => ({ ...previous, [activeSectionKey]: normalizedDraft }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save section.'
      setErrorMessage(message)
    } finally {
      setIsSaving(false)
    }
  }
  handleSaveCurrentSectionRef.current = handleSaveCurrentSection

  const handleSaveAllSections = async () => {
    if (!workspace) return
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
        for (const { key, normalizedDraft } of results) next[key] = normalizedDraft
        return next
      })
      setSavedBySection((previous) => {
        const next = { ...previous }
        for (const { key, normalizedDraft } of results) next[key] = normalizedDraft
        return next
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save all sections.'
      setErrorMessage(message)
    } finally {
      setIsSavingAll(false)
    }
  }

  const handleSaveLyrics = async () => {
    if (!workspace || !activeTrack) return
    setLyricsErrorMessage(null)
    setIsSavingLyrics(true)
    try {
      if (lyricsEditText === activeTrack.lyrics) {
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
    if (!workspace || !activeTrack) return
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
    if (!workspace || !activeTrack) return
    setIsLyricsMenuOpen(false)
    setIsRefetchingLyrics(true)
    setLyricsErrorMessage(null)
    try {
      const artistName = workspace.album.artistNames[0] ?? workspace.album.artistName
      const newLyrics = await getLyricsAsync(activeTrack.title, artistName)
      await updateTrackLyrics(activeTrack.id, newLyrics)
      await deleteLyricsOverrideForCurrentUser(workspace.userSavedAlbumId, activeTrack.trackNumber)
      setLyricsOverrideByTrack((previous) => {
        const next = { ...previous }
        delete next[activeTrack.trackNumber]
        return next
      })
      setWorkspace((previous) => {
        if (!previous) return previous
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

  // @ts-ignore - kept for future tag UI restoration
  const _handleAddTag = async (): Promise<boolean> => {
    if (!workspace || !activeTrack) return false
    const normalized = tagInput.trim().toLowerCase()
    if (!normalized) return false
    setTagErrorMessage(null)
    setIsTagSaving(true)
    try {
      await addTagForCurrentUser(workspace.userSavedAlbumId, activeTrack.trackNumber, normalized)
      setTagsByTrack((previous) => {
        const existing = previous[activeTrack.trackNumber] ?? []
        if (existing.includes(normalized)) return previous
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

  // @ts-ignore - kept for future tag UI restoration
  const _handleRemoveTag = async (tag: string) => {
    if (!workspace || !activeTrack) return
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

  // --- Computed values for console UI ---
  const totalSeconds = workspace.tracks.reduce((sum, t) => sum + (t.durationSeconds ?? 0), 0)
  const totalRuntime = formatDuration(totalSeconds)
  const releaseYear = workspace.album.releaseDate ? workspace.album.releaseDate.slice(0, 4) : ''
  const activeChNum = activeTrack ? String(activeTrack.trackNumber).padStart(2, '0') : '—'

  const parsedScore = parseFloat(activeDraft.scoreInput)
  const scoreNum = isNaN(parsedScore) ? 0 : Math.max(0, Math.min(10, parsedScore))
  const needleAngle = (scoreNum / 10) * 270 - 135
  const scoreDisplay = activeDraft.scoreInput.trim() && !isNaN(parsedScore)
    ? scoreNum.toFixed(1)
    : '—'

  const trackList = workspace.tracks
  const currentTrackIndex = activeTrack
    ? trackList.findIndex((t) => t.trackNumber === activeTrack.trackNumber)
    : -1
  const isFirstSection = currentTrackIndex === 0
  const isLastSection = activeSectionKey === CONCLUSION_KEY

  const navigate = (key: string) => {
    setActiveSectionKey(key)
    setInfoMessage(null)
    setErrorMessage(null)
  }
  const goFirst = () => { if (trackList[0]) navigate(toTrackKey(trackList[0].trackNumber)) }
  const goPrev = () => {
    if (isLastSection) {
      const last = trackList[trackList.length - 1]
      if (last) navigate(toTrackKey(last.trackNumber))
    } else if (currentTrackIndex > 0) {
      navigate(toTrackKey(trackList[currentTrackIndex - 1].trackNumber))
    }
  }
  const goNext = () => {
    if (currentTrackIndex >= 0 && currentTrackIndex < trackList.length - 1) {
      navigate(toTrackKey(trackList[currentTrackIndex + 1].trackNumber))
    } else if (currentTrackIndex === trackList.length - 1) {
      navigate(CONCLUSION_KEY)
    }
  }
  const goLast = () => navigate(CONCLUSION_KEY)

  return (
    <main className="vco-page" style={accentStyle}>
      {/* Top bar */}
      <div className="vco-topbar">
        <LinearBackButton variant="console" />
      </div>

      {/* Console case */}
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
              <div className="vco-cover-pin" />
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
                const hasScore = !!(savedBySection[key]?.scoreInput)
                const widthPct = totalSeconds > 0 && track.durationSeconds
                  ? (track.durationSeconds / totalSeconds) * 100
                  : 100 / trackList.length
                return (
                  <button
                    key={track.id}
                    type="button"
                    className={`vco-tl-seg${isActive ? ' active' : ''}${hasScore ? ' scored' : ''}`}
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
                const hasUnsaved = isDirtyForSection(key)
                const savedScore = savedBySection[key]?.scoreInput
                const scoreDisp = savedScore && !isNaN(Number(savedScore)) ? Number(savedScore).toFixed(1) : ''
                return (
                  <button
                    key={track.id}
                    type="button"
                    className={`vco-tl-item${isActive ? ' active' : ''}`}
                    onClick={() => navigate(key)}
                  >
                    <span className="vco-tl-num">{String(track.trackNumber).padStart(2, '0')}</span>
                    <span className="vco-tl-title">{track.title}</span>
                    {hasUnsaved && !isActive && <span className="vco-tl-dirty" />}
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
                {isDirtyForSection(CONCLUSION_KEY) && !isLastSection && <span className="vco-tl-dirty" />}
                {(() => {
                  const s = savedBySection[CONCLUSION_KEY]?.scoreInput
                  return s && !isNaN(Number(s)) ? <span className="vco-tl-score">{Number(s).toFixed(1)}</span> : null
                })()}
              </button>
            </nav>
          </aside>

          {/* CENTER: Writing section */}
          <section className="vco-center">
            <header className="vco-track-bar">
              <div className="vco-track-info">
                <span className="tn">
                  {activeTrack ? `${activeChNum}.` : '★'}
                </span>
                <span className="tt">
                  {activeTrack ? activeTrack.title : 'Conclusion'}
                </span>
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

            <div className={`vco-text-wrap${isDirty ? ' recording' : ''}`}>
              {activeTrack ? (
                <textarea
                  key={`${activeSectionKey}-${activeNotesTab}`}
                  ref={activeTextareaRef}
                  className="vco-text-panel"
                  value={activeNotesTab === 'lyrically' ? activeDraft.notesLyrically : activeDraft.notesSonically}
                  onChange={(e) => handleNotesChange(activeNotesTab, e.target.value)}
                  style={{ borderLeftColor: 'hsl(var(--accent-h) var(--accent-s) var(--accent-l) / 0.5)' }}
                />
              ) : (
                <textarea
                  ref={activeTextareaRef}
                  className="vco-text-panel"
                  value={activeDraft.notesLyrically}
                  onChange={(e) => handleNotesChange('lyrically', e.target.value)}
                  style={{ borderLeftColor: 'rgba(219,39,119,0.5)' }}
                />
              )}
            </div>

            <footer className="vco-transport">
              <div className="vco-transport-nav">
                <button
                  type="button"
                  className="vco-tbtn"
                  onClick={goFirst}
                  disabled={isFirstSection}
                  title="First track"
                >⟨⟨</button>
                <button
                  type="button"
                  className="vco-tbtn"
                  onClick={goPrev}
                  disabled={isFirstSection}
                  title="Previous"
                >⟨</button>
                <button
                  type="button"
                  className="vco-tbtn"
                  onClick={goNext}
                  disabled={isLastSection}
                  title="Next"
                >⟩</button>
                <button
                  type="button"
                  className="vco-tbtn"
                  onClick={goLast}
                  disabled={isLastSection}
                  title="Last section"
                >⟩⟩</button>
              </div>

              <span className="vco-timecode">
                {activeTrack ? activeChNum : '★'} / {trackList.length}
              </span>

              <button
                type="button"
                className="vco-tbtn primary"
                onClick={() => void handleSaveCurrentSection()}
                disabled={isSaving || isSavingAll || !isDirty}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>

              <button
                type="button"
                className="vco-tbtn"
                onClick={() => void handleSaveAllSections()}
                disabled={isSaving || isSavingAll}
              >
                {isSavingAll ? 'Saving...' : 'Save All'}
              </button>

              <div className="vco-transport-right">
                {activeTrack && (
                  <>

                    <label className="vco-interlude-label">
                      <input
                        type="checkbox"
                        checked={activeDraft.isInterlude}
                        onChange={(e) => handleInterludeChange(e.target.checked)}
                      />
                      Interlude
                    </label>
                  </>
                )}

                <div ref={actionsMenuRef} className="vco-actions-wrap">
                  <button
                    type="button"
                    className="vco-tbtn"
                    onClick={() => setIsActionsMenuOpen((p) => !p)}
                    aria-label="More actions"
                  >
                    &#8943;
                  </button>
                  {isActionsMenuOpen && (
                    <div className="vco-actions-menu">
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
                          className="vco-actions-item"
                        >
                          Recommend song
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
                        className="vco-actions-item"
                      >
                        Recommend album
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </footer>

            {errorMessage && (
              <div className="vco-msg-err">{errorMessage}</div>
            )}
            {infoMessage && (
              <div className="vco-msg-ok">{infoMessage}</div>
            )}
          </section>

          {/* RIGHT: Score dial + lyrics */}
          <aside className="vco-right">
            <div className="vco-dial-wrap">
              <div
                className="vco-dial"
                onClick={() => scoreInputRef.current?.focus()}
                role="presentation"
                title="Click to edit score"
              >
                <div
                  className="vco-dial-needle"
                  style={{ transform: `translateX(-50%) rotate(${needleAngle}deg)` }}
                />
                <div className="vco-dial-inner">{scoreDisplay}</div>
              </div>
              <div className="vco-dial-info">
                <div className="lab">Score</div>
                <div className="val">
                  {scoreDisplay}<span>/10</span>
                </div>
                <input
                  ref={scoreInputRef}
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={activeDraft.scoreInput}
                  onChange={(e) => handleScoreChange(e.target.value)}
                  placeholder="0.0"
                  className="vco-score-input"
                />
              </div>
            </div>

            <div className="vco-lyr-panel">
              <header className="vco-lyr-head">
                <span>
                  {activeTrack ? `Lyrics · ${activeChNum}` : 'Lyrics'}
                </span>
                {activeTrack && !isEditingLyrics && (
                  <div className="vco-lyr-actions">
                    <button
                      type="button"
                      className={`vco-lyr-btn${quoteModeEnabled ? ' active' : ''}`}
                      onClick={() => setQuoteModeEnabled((p) => !p)}
                      title={quoteModeEnabled ? 'Click-to-quote: on' : 'Click-to-quote: off'}
                      aria-label={quoteModeEnabled ? 'Disable click-to-quote' : 'Enable click-to-quote'}
                    >
                      &#8220; QUOTE
                    </button>
                    <button
                      type="button"
                      className="vco-lyr-btn"
                      onClick={() => {
                        const displayed = lyricsOverrideByTrack[activeTrack.trackNumber] ?? activeTrack.lyrics
                        setLyricsEditText(displayed)
                        setLyricsErrorMessage(null)
                        setIsEditingLyrics(true)
                      }}
                    >
                      EDIT
                    </button>
                    <div ref={lyricsMenuRef} className="vco-lyr-menu-wrap">
                      <button
                        type="button"
                        className="vco-lyr-btn"
                        disabled={isRefetchingLyrics}
                        onClick={() => setIsLyricsMenuOpen((o) => !o)}
                        aria-label="Lyrics options"
                      >
                        {isRefetchingLyrics ? '...' : '⋯'}
                      </button>
                      {isLyricsMenuOpen && (
                        <div className="vco-lyr-menu">
                          <button
                            type="button"
                            onClick={() => void handleRefetchLyrics()}
                            className="vco-lyr-menu-item"
                          >
                            Re-fetch lyrics
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </header>

              <div className="vco-lyr-body">
                {!activeTrack ? (
                  <p className="vco-lyr-empty">Conclusion has no lyrics.</p>
                ) : isEditingLyrics ? (
                  <>
                    <textarea
                      value={lyricsEditText}
                      onChange={(e) => setLyricsEditText(e.target.value)}
                      className="vco-lyr-edit-textarea"
                    />
                    {lyricsErrorMessage && (
                      <p className="vco-lyr-error">{lyricsErrorMessage}</p>
                    )}
                    <div className="vco-lyr-edit-actions">
                      <button
                        type="button"
                        onClick={() => void handleSaveLyrics()}
                        disabled={isSavingLyrics}
                        className="vco-tbtn primary"
                      >
                        {isSavingLyrics ? 'SAVING...' : 'SAVE'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingLyrics(false)}
                        disabled={isSavingLyrics}
                        className="vco-tbtn"
                      >
                        CANCEL
                      </button>
                      {lyricsOverrideByTrack[activeTrack.trackNumber] !== undefined && (
                        <button
                          type="button"
                          onClick={() => void handleRevertLyrics()}
                          disabled={isSavingLyrics}
                          className="vco-tbtn vco-tbtn-danger"
                        >
                          REVERT
                        </button>
                      )}
                    </div>
                  </>
                ) : (() => {
                  const displayed = lyricsOverrideByTrack[activeTrack.trackNumber] ?? activeTrack.lyrics
                  const hasOverride = lyricsOverrideByTrack[activeTrack.trackNumber] !== undefined
                  if (!displayed.trim()) {
                    return <p className="vco-lyr-empty">No lyrics stored for this track.</p>
                  }
                  return (
                    <>
                      {hasOverride && <p className="vco-lyr-edited">Edited</p>}
                      {quoteModeEnabled ? (
                        displayed.split('\n').map((line, i) =>
                          line.trim() ? (
                            <button
                              key={i}
                              type="button"
                              className="vco-lyr-line"
                              onClick={() => handleQuoteLine(line)}
                            >
                              <span className="ln">{i + 1}</span>
                              {line}
                            </button>
                          ) : (
                            <div key={i} className="vco-lyr-gap" />
                          )
                        )
                      ) : (
                        <pre className="vco-lyr-pre">{displayed}</pre>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          </aside>

        </div>

      </div>

      {/* Recommendation modal */}
      {isRecommendationModalOpen && workspace && recommendationItemTitle && recommendationArtistName && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => { if (!isRecommendationSubmitting) setIsRecommendationModalOpen(false) }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="recommend-title"
            className="vco-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="recommend-title" className="vco-modal-title">
              {recommendationType === 'album' ? 'Recommend this album?' : 'Recommend this song?'}
            </h2>
            <div className="vco-modal-info">
              <p className="vco-modal-item-title">{recommendationItemTitle}</p>
              <p className="vco-modal-item-artist">{recommendationArtistName}</p>
              <p className="vco-modal-item-type">
                {recommendationType === 'album' ? 'Album' : 'Song'}
              </p>
            </div>
            <label className="vco-modal-label">
              Send To
              <select
                value={selectedRecommendationFriendUserId}
                onChange={(e) => setSelectedRecommendationFriendUserId(e.target.value)}
                disabled={friends.length === 0 || isRecommendationSubmitting}
                className="vco-modal-select"
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
              <p className="vco-modal-note">Add a friend first to send recommendations.</p>
            )}
            {recommendationErrorMessage && (
              <div className="vco-msg-err" style={{ marginTop: '12px' }}>
                {recommendationErrorMessage}
              </div>
            )}
            <div className="vco-modal-actions">
              <button
                type="button"
                onClick={() => setIsRecommendationModalOpen(false)}
                disabled={isRecommendationSubmitting}
                className="vco-tbtn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSendRecommendation()}
                disabled={isRecommendationSubmitting || friends.length === 0}
                className="vco-tbtn primary"
              >
                {isRecommendationSubmitting ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default AlbumReviewPage
