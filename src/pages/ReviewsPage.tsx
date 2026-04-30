import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AlbumCover from '../components/AlbumCover'
import LinearBackButton from '../components/LinearBackButton'
import { getFriendsOverviewForCurrentUser, type FriendProfile } from '../lib/db/friendsData'
import {
  listSavedAlbumsForCurrentUser,
  removeAlbumForCurrentUser,
  resetAlbumDataForCurrentUser,
  type SavedAlbumCard,
} from '../lib/db/reviewsData'
import { sendRecommendationForCurrentUser } from '../lib/db/toListenData'
import { getHomeBackgroundForCurrentUser, setHomeBackgroundForCurrentUser } from '../lib/db/profileData'

type PendingAction =
  | { type: 'remove'; album: SavedAlbumCard }
  | { type: 'recommend'; album: SavedAlbumCard }
  | { type: 'reset'; album: SavedAlbumCard }

function ReviewsPage() {
  const navigate = useNavigate()
  const [albums, setAlbums] = useState<SavedAlbumCard[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [friends, setFriends] = useState<FriendProfile[]>([])
  const [selectedFriendUserId, setSelectedFriendUserId] = useState('')
  const [activeMenuAlbumId, setActiveMenuAlbumId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [resetInput, setResetInput] = useState('')
  const [backgroundAlbumId, setBackgroundAlbumId] = useState<string | null>(null)
  const [loadedCovers, setLoadedCovers] = useState<Set<string>>(new Set())

  useEffect(() => {
    let isActive = true

    const load = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const [savedAlbums, friendsOverview, currentBackground] = await Promise.all([
          listSavedAlbumsForCurrentUser(),
          getFriendsOverviewForCurrentUser(),
          getHomeBackgroundForCurrentUser(),
        ])

        if (!isActive) {
          return
        }

        setAlbums(savedAlbums)
        setFriends(friendsOverview.friends)
        setSelectedFriendUserId(friendsOverview.friends[0]?.userId ?? '')

        const matchingAlbum = savedAlbums.find((a) => a.coverUrl === currentBackground)
        setBackgroundAlbumId(matchingAlbum?.userSavedAlbumId ?? null)
      } catch (error) {
        if (!isActive) {
          return
        }
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load albums.')
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    if (!activeMenuAlbumId) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) {
        return
      }
      if (!menuRef.current?.contains(event.target)) {
        setActiveMenuAlbumId(null)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveMenuAlbumId(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeMenuAlbumId])

  const openAction = (action: PendingAction) => {
    setActiveMenuAlbumId(null)
    setModalError(null)
    setResetInput('')
    setPendingAction(action)
  }

  const closeModal = () => {
    if (isSubmitting) {
      return
    }
    setPendingAction(null)
    setModalError(null)
    setResetInput('')
  }

  const handleRemove = async () => {
    if (!pendingAction || pendingAction.type !== 'remove') {
      return
    }

    setIsSubmitting(true)
    setModalError(null)

    try {
      await removeAlbumForCurrentUser(pendingAction.album.userSavedAlbumId)
      setAlbums((prev) => prev.filter((a) => a.userSavedAlbumId !== pendingAction.album.userSavedAlbumId))
      setPendingAction(null)
    } catch (error) {
      setModalError(error instanceof Error ? error.message : 'Failed to remove album.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRecommend = async () => {
    if (!pendingAction || pendingAction.type !== 'recommend') {
      return
    }

    setIsSubmitting(true)
    setModalError(null)

    try {
      await sendRecommendationForCurrentUser({
        friendUserId: selectedFriendUserId,
        recommendationType: 'album',
        songName: pendingAction.album.title,
        artistName: pendingAction.album.artistName,
      })
      setPendingAction(null)
    } catch (error) {
      setModalError(error instanceof Error ? error.message : 'Failed to send recommendation.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = async () => {
    if (!pendingAction || pendingAction.type !== 'reset') {
      return
    }
    if (resetInput !== pendingAction.album.title) {
      return
    }

    setIsSubmitting(true)
    setModalError(null)

    try {
      await resetAlbumDataForCurrentUser(pendingAction.album.userSavedAlbumId)
      setPendingAction(null)
    } catch (error) {
      setModalError(error instanceof Error ? error.message : 'Failed to reset album data.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSetBackground = async (album: SavedAlbumCard) => {
    setActiveMenuAlbumId(null)

    const isAlreadyBackground = backgroundAlbumId === album.userSavedAlbumId
    const nextCoverUrl = isAlreadyBackground ? null : (album.coverUrl ?? null)

    try {
      await setHomeBackgroundForCurrentUser(nextCoverUrl)
      setBackgroundAlbumId(isAlreadyBackground ? null : album.userSavedAlbumId)
    } catch {
      // silently fail — background is non-critical
    }
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex items-center gap-3">
          <LinearBackButton />
          <button
            type="button"
            onClick={() => navigate('/reviews/add')}
            className="rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-white"
          >
            Add Album
          </button>
        </div>

        {isLoading && (
          <p className="mt-6 rounded-lg bg-surface p-4 text-sm text-ink">Loading albums...</p>
        )}

        {!isLoading && errorMessage && (
          <div className="mt-6 rounded-lg border border-err-edge bg-err-bg p-4 text-sm text-err">
            <p>Could not load albums.</p>
            <p className="mt-1">{errorMessage}</p>
          </div>
        )}

        {!isLoading && !errorMessage && albums.length === 0 && (
          <p className="mt-6 rounded-lg bg-surface p-4 text-sm text-ink">
            No albums saved yet. Use `Add Album` to add your first album.
          </p>
        )}

        {!isLoading && !errorMessage && albums.length > 0 && (
          <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {albums.map((album) => {
              const isMenuOpen = activeMenuAlbumId === album.userSavedAlbumId

              return (
                <div
                  key={album.userSavedAlbumId}
                  ref={isMenuOpen ? menuRef : null}
                  className={`relative transition-opacity duration-300 ${
                    loadedCovers.has(album.userSavedAlbumId) || !album.coverUrl ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-surface-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/reviews/${album.userSavedAlbumId}`)}
                      className="h-full w-full"
                      aria-label={`Open ${album.title}`}
                    >
                      <AlbumCover
                          src={album.coverUrl}
                          alt={`${album.title} cover`}
                          loading="lazy"
                          onLoad={() => setLoadedCovers((prev) => { const next = new Set(prev); next.add(album.userSavedAlbumId); return next })}
                        />
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setActiveMenuAlbumId(isMenuOpen ? null : album.userSavedAlbumId)
                      }}
                      className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                      aria-label="Album options"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/reviews/${album.userSavedAlbumId}`)}
                    className="mt-2 block w-full text-left"
                  >
                    <p className="truncate text-sm font-semibold text-ink">{album.title}</p>
                    <p className="truncate text-xs text-ink-2">{album.artistName}</p>
                  </button>

                  {backgroundAlbumId === album.userSavedAlbumId && (
                    <div className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-cta ring-offset-1" />
                  )}

                  {isMenuOpen && (
                    <div className="absolute left-0 top-0 z-10 w-52 overflow-hidden rounded-xl border border-edge bg-surface p-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => void handleSetBackground(album)}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-surface-2"
                      >
                        {backgroundAlbumId === album.userSavedAlbumId
                          ? 'Remove home background'
                          : 'Set as home background'}
                      </button>
                      <div className="my-1 border-t border-edge" />
                      <button
                        type="button"
                        onClick={() => openAction({ type: 'remove', album })}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-err hover:bg-err-bg"
                      >
                        Remove this album
                      </button>
                      <button
                        type="button"
                        onClick={() => openAction({ type: 'recommend', album })}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-surface-2"
                      >
                        Recommend this album
                      </button>
                      <button
                        type="button"
                        onClick={() => openAction({ type: 'reset', album })}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-surface-2"
                      >
                        Reset album data
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        )}
      </div>

      {pendingAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-xl border border-edge bg-surface p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            {pendingAction.type === 'remove' && (
              <>
                <h2 className="text-lg font-bold text-ink">Remove album?</h2>
                <p className="mt-2 text-sm text-ink">
                  This will remove{' '}
                  <span className="font-semibold">{pendingAction.album.title}</span> from your
                  library. Your review data will also be deleted.
                </p>
                {modalError && (
                  <p className="mt-3 text-sm text-err">{modalError}</p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={isSubmitting}
                    className="rounded-lg border border-edge px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRemove()}
                    disabled={isSubmitting}
                    className="rounded-lg bg-err-edge px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {isSubmitting ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              </>
            )}

            {pendingAction.type === 'recommend' && (
              <>
                <h2 className="text-lg font-bold text-ink">Recommend this album</h2>
                <div className="mt-3 rounded-lg border border-edge bg-surface-2 px-4 py-3">
                  <p className="text-sm font-semibold text-ink">{pendingAction.album.title}</p>
                  <p className="mt-1 text-sm text-ink">{pendingAction.album.artistName}</p>
                </div>
                <label className="mt-4 block text-sm font-semibold text-ink">
                  Send To
                  <select
                    value={selectedFriendUserId}
                    onChange={(event) => setSelectedFriendUserId(event.target.value)}
                    disabled={friends.length === 0 || isSubmitting}
                    className="mt-1 w-full rounded-lg border border-edge px-3 py-2 text-sm"
                  >
                    {friends.length === 0 ? (
                      <option value="">No friends yet</option>
                    ) : (
                      friends.map((friend) => (
                        <option key={friend.userId} value={friend.userId}>
                          {friend.username?.trim() || friend.friendCode}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                {modalError && (
                  <p className="mt-3 text-sm text-err">{modalError}</p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={isSubmitting}
                    className="rounded-lg border border-edge px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRecommend()}
                    disabled={isSubmitting || !selectedFriendUserId}
                    className="rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {isSubmitting ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </>
            )}

            {pendingAction.type === 'reset' && (
              <>
                <h2 className="text-lg font-bold text-ink">Reset album data?</h2>
                <div className="mt-3 rounded-lg border border-warn-edge bg-warn-bg p-3 text-sm text-warn">
                  This will permanently delete all notes, scores, tags, and lyrics edits for{' '}
                  <span className="font-semibold">{pendingAction.album.title}</span>. The album
                  will remain in your library but all review data will be gone.
                </div>
                <label className="mt-4 block text-sm font-semibold text-ink">
                  Type the album title to confirm
                  <input
                    type="text"
                    value={resetInput}
                    onChange={(event) => setResetInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && resetInput === pendingAction.album.title) {
                        void handleReset()
                      }
                    }}
                    placeholder={pendingAction.album.title}
                    autoFocus
                    className="mt-1 w-full rounded-lg border border-edge px-3 py-2 text-sm"
                  />
                </label>
                {modalError && (
                  <p className="mt-3 text-sm text-err">{modalError}</p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={isSubmitting}
                    className="rounded-lg border border-edge px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReset()}
                    disabled={isSubmitting || resetInput !== pendingAction.album.title}
                    className="rounded-lg bg-err-edge px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {isSubmitting ? 'Resetting...' : 'Reset'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

export default ReviewsPage
