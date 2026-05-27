import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AlbumCover from '../components/AlbumCover'
import { StellarHorizon } from '../components/StellarHorizon'
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
  const [searchQuery, setSearchQuery] = useState('')

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
        if (!isActive) return
        setAlbums(savedAlbums)
        setFriends(friendsOverview.friends)
        setSelectedFriendUserId(friendsOverview.friends[0]?.userId ?? '')
        const matchingAlbum = savedAlbums.find((a) => a.coverUrl === currentBackground)
        setBackgroundAlbumId(matchingAlbum?.userSavedAlbumId ?? null)
      } catch (error) {
        if (!isActive) return
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load albums.')
      } finally {
        if (isActive) setIsLoading(false)
      }
    }
    void load()
    return () => { isActive = false }
  }, [])

  useEffect(() => {
    if (!activeMenuAlbumId) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (!menuRef.current?.contains(event.target)) setActiveMenuAlbumId(null)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveMenuAlbumId(null)
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
    if (isSubmitting) return
    setPendingAction(null)
    setModalError(null)
    setResetInput('')
  }

  const handleRemove = async () => {
    if (!pendingAction || pendingAction.type !== 'remove') return
    if (resetInput !== pendingAction.album.title) return
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
    if (!pendingAction || pendingAction.type !== 'recommend') return
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
    if (!pendingAction || pendingAction.type !== 'reset') return
    if (resetInput !== pendingAction.album.title) return
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

  const filteredAlbums = searchQuery.trim()
    ? albums.filter((a) => {
        const q = searchQuery.toLowerCase()
        return a.title.toLowerCase().includes(q) || a.artistName.toLowerCase().includes(q)
      })
    : albums

  return (
    <main className="min-h-screen px-6 py-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/reviews/add')}
            className="vco-tbtn primary"
          >
            + Add Album
          </button>
        </div>

        <div className="mt-4">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search albums or artists..."
            className="w-full rounded border border-[#2a2548] bg-[#100d22] px-4 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          />
        </div>

        <StellarHorizon label={`MY LIBRARY · ${albums.length} CHARTED`} />

        {(isLoading || (!errorMessage && albums.length > 0 && loadedCovers.size < albums.filter((a) => a.coverUrl).length)) && (
          <div className="mt-12 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2a2548] border-t-ink-2" />
          </div>
        )}

        {!isLoading && errorMessage && (
          <div className="vco-msg-err" style={{ marginTop: 20 }}>
            <p>Could not load albums.</p>
            <p style={{ marginTop: 4 }}>{errorMessage}</p>
          </div>
        )}

        {!isLoading && !errorMessage && albums.length === 0 && (
          <p className="vco-empty">No albums saved yet. Use "Add Album" to add your first album.</p>
        )}

        {!isLoading && !errorMessage && albums.length > 0 && filteredAlbums.length === 0 && (
          <p className="vco-empty">No albums match your search.</p>
        )}

        {!isLoading && !errorMessage && filteredAlbums.length > 0 && (
          <motion.section
            className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
            initial="hidden"
            animate={loadedCovers.size >= albums.filter((a) => a.coverUrl).length ? 'visible' : 'hidden'}
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
          >
            {filteredAlbums.map((album) => {
              const isMenuOpen = activeMenuAlbumId === album.userSavedAlbumId
              return (
                <motion.div
                  key={album.userSavedAlbumId}
                  ref={isMenuOpen ? menuRef : null}
                  className="relative group"
                  variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.16, 1, 0.3, 1] } } }}
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-surface-2 cover-halo transition-transform duration-200 ease-out group-hover:scale-[1.025]">
                    <button
                      type="button"
                      onClick={() => navigate(`/reviews/${album.userSavedAlbumId}`)}
                      className="h-full w-full"
                      aria-label={`Open ${album.title}`}
                    >
                      <AlbumCover
                        src={album.coverUrl}
                        alt={`${album.title} cover`}
                        loading="eager"
                        onLoad={() => setLoadedCovers((prev) => { const next = new Set(prev); next.add(album.userSavedAlbumId); return next })}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setActiveMenuAlbumId(isMenuOpen ? null : album.userSavedAlbumId)
                      }}
                      className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                      aria-label="Album options"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
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
                    <p className="truncate text-sm font-semibold text-ink transition-colors duration-200 group-hover:text-[#ede9fe]">{album.title}</p>
                    <p className="truncate text-xs text-ink-3 transition-colors duration-200 group-hover:text-ink-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{album.artistName}</p>
                  </button>

                  {backgroundAlbumId === album.userSavedAlbumId && (
                    <div className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-[#7c3aed] ring-offset-1 ring-offset-[#0e0c1c]" />
                  )}

                  {isMenuOpen && (
                    <div className="vco-actions-menu" style={{ top: 0, left: 0, bottom: 'auto', position: 'absolute', minWidth: 200 }}>
                      <button
                        type="button"
                        onClick={() => void handleSetBackground(album)}
                        className="vco-actions-item"
                      >
                        {backgroundAlbumId === album.userSavedAlbumId ? 'Remove home background' : 'Set as home background'}
                      </button>
                      <div style={{ borderTop: '1px solid #2a2548', margin: '2px 0' }} />
                      <button
                        type="button"
                        onClick={() => openAction({ type: 'recommend', album })}
                        className="vco-actions-item"
                      >
                        Recommend this album
                      </button>
                      <button
                        type="button"
                        onClick={() => openAction({ type: 'reset', album })}
                        className="vco-actions-item"
                      >
                        Reset album data
                      </button>
                      <button
                        type="button"
                        onClick={() => openAction({ type: 'remove', album })}
                        className="vco-actions-item"
                        style={{ color: '#fca5a5' }}
                      >
                        Remove this album
                      </button>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </motion.section>
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
            className="vco-modal"
            onClick={(event) => event.stopPropagation()}
          >
            {pendingAction.type === 'remove' && (
              <>
                <h2 className="vco-modal-title">Remove album?</h2>
                <div className="vco-msg-err" style={{ margin: '0 0 14px' }}>
                  This will permanently remove{' '}
                  <span style={{ fontWeight: 700 }}>{pendingAction.album.title}</span> and all its review data.
                </div>
                <label className="vco-modal-label">
                  Type the album title to confirm
                  <input
                    type="text"
                    value={resetInput}
                    onChange={(event) => setResetInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && resetInput === pendingAction.album.title) void handleRemove()
                    }}
                    placeholder={pendingAction.album.title}
                    autoFocus
                    className="vco-modal-select"
                    style={{ marginTop: 6, padding: '6px 10px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
                  />
                </label>
                {modalError && <div className="vco-msg-err" style={{ marginTop: 10 }}>{modalError}</div>}
                <div className="vco-modal-actions">
                  <button type="button" onClick={closeModal} disabled={isSubmitting} className="vco-tbtn">Cancel</button>
                  <button
                    type="button"
                    onClick={() => void handleRemove()}
                    disabled={isSubmitting || resetInput !== pendingAction.album.title}
                    className="vco-tbtn vco-tbtn-danger"
                  >
                    {isSubmitting ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              </>
            )}

            {pendingAction.type === 'recommend' && (
              <>
                <h2 className="vco-modal-title">Recommend this album</h2>
                <div className="vco-modal-info">
                  <p className="vco-modal-item-title">{pendingAction.album.title}</p>
                  <p className="vco-modal-item-artist">{pendingAction.album.artistName}</p>
                </div>
                <label className="vco-modal-label">
                  Send To
                  <select
                    value={selectedFriendUserId}
                    onChange={(event) => setSelectedFriendUserId(event.target.value)}
                    disabled={friends.length === 0 || isSubmitting}
                    className="vco-modal-select"
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
                {modalError && <div className="vco-msg-err" style={{ marginTop: 10 }}>{modalError}</div>}
                <div className="vco-modal-actions">
                  <button type="button" onClick={closeModal} disabled={isSubmitting} className="vco-tbtn">Cancel</button>
                  <button
                    type="button"
                    onClick={() => void handleRecommend()}
                    disabled={isSubmitting || !selectedFriendUserId}
                    className="vco-tbtn primary"
                  >
                    {isSubmitting ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </>
            )}

            {pendingAction.type === 'reset' && (
              <>
                <h2 className="vco-modal-title">Reset album data?</h2>
                <div className="vco-msg-err" style={{ margin: '0 0 14px' }}>
                  This will permanently delete all notes, scores, and lyrics edits for{' '}
                  <span style={{ fontWeight: 700 }}>{pendingAction.album.title}</span>. The album stays in your library.
                </div>
                <label className="vco-modal-label">
                  Type the album title to confirm
                  <input
                    type="text"
                    value={resetInput}
                    onChange={(event) => setResetInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && resetInput === pendingAction.album.title) void handleReset()
                    }}
                    placeholder={pendingAction.album.title}
                    autoFocus
                    className="vco-modal-select"
                    style={{ marginTop: 6, padding: '6px 10px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
                  />
                </label>
                {modalError && <div className="vco-msg-err" style={{ marginTop: 10 }}>{modalError}</div>}
                <div className="vco-modal-actions">
                  <button type="button" onClick={closeModal} disabled={isSubmitting} className="vco-tbtn">Cancel</button>
                  <button
                    type="button"
                    onClick={() => void handleReset()}
                    disabled={isSubmitting || resetInput !== pendingAction.album.title}
                    className="vco-tbtn vco-tbtn-danger"
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
