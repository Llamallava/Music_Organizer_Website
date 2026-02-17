import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getAlbumWorkspaceForCurrentUser,
  upsertConclusionSectionForCurrentUser,
  upsertTrackReviewSectionForCurrentUser,
  type AlbumWorkspace,
} from '../lib/db/reviewsData'

type SectionDraft = {
  notes: string
  scoreInput: string
}

type DraftMap = Record<string, SectionDraft>

const CONCLUSION_KEY = 'conclusion'

const toTrackKey = (trackNumber: number) => `track:${trackNumber}`

const defaultDraft = (): SectionDraft => ({
  notes: '',
  scoreInput: '',
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
      }
      continue
    }

    if (section.sectionType === 'conclusion') {
      map[CONCLUSION_KEY] = {
        notes: section.notes,
        scoreInput: section.score === null ? '' : String(section.score),
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
  const navigate = useNavigate()
  const { userSavedAlbumId } = useParams()
  const [workspace, setWorkspace] = useState<AlbumWorkspace | null>(null)
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
        const loadedWorkspace = await getAlbumWorkspaceForCurrentUser(userSavedAlbumId)

        if (!isActive) {
          return
        }

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
    activeDraft.notes !== activeSavedDraft.notes || activeDraft.scoreInput !== activeSavedDraft.scoreInput

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
          notes: activeDraft.notes,
          score,
        })
      }

      const normalizedDraft: SectionDraft = {
        notes: activeDraft.notes,
        scoreInput: score === null ? '' : String(score),
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
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="rounded-lg bg-white px-4 py-3 text-sm text-slate-700">Loading review workspace...</p>
      </main>
    )
  }

  if (!workspace) {
    return (
      <main className="min-h-screen px-6 py-8">
        <div className="mx-auto w-full max-w-6xl">
          <button
            type="button"
            onClick={() => navigate('/reviews')}
            className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-900"
          >
            Back to Reviews
          </button>
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
        <button
          type="button"
          onClick={() => navigate('/reviews')}
          className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-900"
        >
          Back to Reviews
        </button>

        <section className="mt-6 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="aspect-square w-full overflow-hidden rounded-lg bg-slate-200">
                {workspace.album.coverUrl ? (
                  <img
                    src={workspace.album.coverUrl}
                    alt={`${workspace.album.title} cover`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">
                    No Cover
                  </div>
                )}
              </div>
              <h1 className="mt-3 text-base font-bold text-slate-900">{workspace.album.title}</h1>
              <p className="text-sm text-slate-700">{workspace.album.artistName}</p>
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

            <textarea
              value={activeDraft.notes}
              onChange={(event) => handleNotesChange(event.target.value)}
              placeholder={activeTrack ? 'Write your notes for this track...' : 'Write your final album thoughts...'}
              className="h-[62vh] w-full resize-none rounded-lg border border-slate-300 p-3 text-sm leading-relaxed text-slate-900"
            />

            <div className="mt-3 flex items-center gap-3">
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
    </main>
  )
}

export default AlbumReviewPage
