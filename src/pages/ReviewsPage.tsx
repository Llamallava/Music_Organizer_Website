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

  useEffect(() => {
    let isActive = true

    const load = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const [savedAlbums, friendsOverview] = await Promise.all([
          listSavedAlbumsForCurrentUser(),
          getFriendsOverviewForCurrentUser(),
        ])

        if (!isActive) {
          return
        }

        setAlbums(savedAlbums)
        setFriends(friendsOverview.friends)
        setSelectedFriendUserId(friendsOverview.friends[0]?.userId ?? '')
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

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex items-center gap-3">
          <LinearBackButton />
          <button
            type="button"
            onClick={() => navigate('/reviews/add')}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Add Album
          </button>
        </div>

        {isLoading && (
          <p className="mt-6 rounded-lg bg-white p-4 text-sm text-slate-700">Loading albums...</p>
        )}

        {!isLoading && errorMessage && (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <p>Could not load albums.</p>
            <p className="mt-1">{errorMessage}</p>
          </div>
        )}

        {!isLoading && !errorMessage && albums.length === 0 && (
          <p className="mt-6 rounded-lg bg-white p-4 text-sm text-slate-700">
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
                  className="relative"
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-200">
                    <button
                      type="button"
                      onClick={() => navigate(`/reviews/${album.userSavedAlbumId}`)}
                      className="h-full w-full"
                      aria-label={`Open ${album.title}`}
                    >
                      <AlbumCover src={album.coverUrl} alt={`${album.title} cover`} loading="lazy" />
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
                    <p className="truncate text-sm font-semibold text-slate-900">{album.title}</p>
                    <p className="truncate text-xs text-slate-600">{album.artistName}</p>
                  </button>

                  {isMenuOpen && (
                    <div className="absolute left-0 top-0 z-10 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => openAction({ type: 'remove', album })}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        Remove this album
                      </button>
                      <button
                        type="button"
                        onClick={() => openAction({ type: 'recommend', album })}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-100"
                      >
                        Recommend this album
                      </button>
                      <button
                        type="button"
                        onClick={() => openAction({ type: 'reset', album })}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-100"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            {pendingAction.type === 'remove' && (
              <>
                <h2 className="text-lg font-bold text-slate-900">Remove album?</h2>
                <p className="mt-2 text-sm text-slate-700">
                  This will remove{' '}
                  <span className="font-semibold">{pendingAction.album.title}</span> from your
                  library. Your review data will also be deleted.
                </p>
                {modalError && (
                  <p className="mt-3 text-sm text-rose-600">{modalError}</p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={isSubmitting}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRemove()}
                    disabled={isSubmitting}
                    className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {isSubmitting ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              </>
            )}

            {pendingAction.type === 'recommend' && (
              <>
                <h2 className="text-lg font-bold text-slate-900">Recommend this album</h2>
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{pendingAction.album.title}</p>
                  <p className="mt-1 text-sm text-slate-700">{pendingAction.album.artistName}</p>
                </div>
                <label className="mt-4 block text-sm font-semibold text-slate-800">
                  Send To
                  <select
                    value={selectedFriendUserId}
                    onChange={(event) => setSelectedFriendUserId(event.target.value)}
                    disabled={friends.length === 0 || isSubmitting}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                  <p className="mt-3 text-sm text-rose-600">{modalError}</p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={isSubmitting}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRecommend()}
                    disabled={isSubmitting || !selectedFriendUserId}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {isSubmitting ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </>
            )}

            {pendingAction.type === 'reset' && (
              <>
                <h2 className="text-lg font-bold text-slate-900">Reset album data?</h2>
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  This will permanently delete all notes, scores, tags, and lyrics edits for{' '}
                  <span className="font-semibold">{pendingAction.album.title}</span>. The album
                  will remain in your library but all review data will be gone.
                </div>
                <label className="mt-4 block text-sm font-semibold text-slate-800">
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
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                {modalError && (
                  <p className="mt-3 text-sm text-rose-600">{modalError}</p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={isSubmitting}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReset()}
                    disabled={isSubmitting || resetInput !== pendingAction.album.title}
                    className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
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
