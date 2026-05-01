import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import LinearBackButton from '../components/LinearBackButton'
import { getFriendsOverviewForCurrentUser, type FriendProfile } from '../lib/db/friendsData'
import {
  addToListenSongForCurrentUser,
  listReceivedRecommendationsForCurrentUser,
  listToListenSongsForCurrentUser,
  removeReceivedRecommendationForCurrentUser,
  removeToListenSongForCurrentUser,
  sendRecommendationForCurrentUser,
  type ReceivedRecommendation,
  type ToListenSong,
} from '../lib/db/toListenData'

type ListItem =
  | { kind: 'personal'; id: string; songName: string; artistName: string; createdAt: string }
  | { kind: 'recommendation'; id: string; songName: string; artistName: string; createdAt: string; senderName: string }

const getFriendDisplayName = (username: string | null | undefined, friendCode: string | null | undefined) => {
  const trimmedName = username?.trim()
  if (trimmedName) return trimmedName
  return friendCode ?? 'Unknown User'
}

function ToListenPage() {
  const [toListenSongs, setToListenSongs] = useState<ToListenSong[]>([])
  const [receivedRecommendations, setReceivedRecommendations] = useState<ReceivedRecommendation[]>([])
  const [friends, setFriends] = useState<FriendProfile[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isFriendSelectModalOpen, setIsFriendSelectModalOpen] = useState(false)
  const [songName, setSongName] = useState('')
  const [artistName, setArtistName] = useState('')
  const [selectedFriendUserId, setSelectedFriendUserId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false)
  const [isSubmittingSend, setIsSubmittingSend] = useState(false)
  const [removingItemId, setRemovingItemId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    const loadData = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const [toListenRecords, recommendationRecords, friendsOverview] = await Promise.all([
          listToListenSongsForCurrentUser(),
          listReceivedRecommendationsForCurrentUser(),
          getFriendsOverviewForCurrentUser(),
        ])

        if (!isActive) return

        setToListenSongs(toListenRecords)
        setReceivedRecommendations(recommendationRecords)
        setFriends(friendsOverview.friends)
        setSelectedFriendUserId((previous) => previous || friendsOverview.friends[0]?.userId || '')
      } catch (error) {
        if (!isActive) return
        const message = error instanceof Error ? error.message : 'Failed to load data.'
        setErrorMessage(message)
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    void loadData()
    return () => { isActive = false }
  }, [])

  const closeAddModal = () => {
    setIsAddModalOpen(false)
    setSongName('')
    setArtistName('')
  }

  const handleAddToList = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmittingAdd(true)

    try {
      const addedSong = await addToListenSongForCurrentUser({ songName, artistName })
      setToListenSongs((previous) => [addedSong, ...previous])
      closeAddModal()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add song.'
      setErrorMessage(message)
    } finally {
      setIsSubmittingAdd(false)
    }
  }

  const handleOpenFriendSelect = () => {
    setIsAddModalOpen(false)
    setSelectedFriendUserId((previous) => previous || friends[0]?.userId || '')
    setIsFriendSelectModalOpen(true)
  }

  const handleSendToFriend = async () => {
    setErrorMessage(null)
    setIsSubmittingSend(true)

    try {
      await sendRecommendationForCurrentUser({
        friendUserId: selectedFriendUserId,
        songName,
        artistName,
      })
      setSongName('')
      setArtistName('')
      setIsFriendSelectModalOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send recommendation.'
      setErrorMessage(message)
    } finally {
      setIsSubmittingSend(false)
    }
  }

  const handleListened = async (item: ListItem) => {
    setErrorMessage(null)
    setRemovingItemId(item.id)

    try {
      if (item.kind === 'personal') {
        await removeToListenSongForCurrentUser(item.id)
        setToListenSongs((previous) => previous.filter((s) => s.id !== item.id))
      } else {
        await removeReceivedRecommendationForCurrentUser(item.id)
        setReceivedRecommendations((previous) => previous.filter((r) => r.id !== item.id))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove entry.'
      setErrorMessage(message)
    } finally {
      setRemovingItemId(null)
    }
  }

  const unifiedList: ListItem[] = [
    ...toListenSongs.map((s) => ({
      kind: 'personal' as const,
      id: s.id,
      songName: s.songName,
      artistName: s.artistName,
      createdAt: s.createdAt,
    })),
    ...receivedRecommendations.map((r) => ({
      kind: 'recommendation' as const,
      id: r.id,
      songName: r.songName,
      artistName: r.artistName,
      createdAt: r.createdAt,
      senderName: getFriendDisplayName(r.senderUsername, r.senderFriendCode),
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <LinearBackButton />

        <h1 className="mt-5 text-3xl font-black text-ink">To-Listen</h1>

        {errorMessage && (
          <div className="mt-4 rounded-lg border border-err-edge bg-err-bg p-3 text-sm text-err">
            {errorMessage}
          </div>
        )}

        <div className="mt-6">
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="rounded-lg bg-cta px-3 py-1.5 text-sm font-semibold text-white"
          >
            + Add
          </button>
        </div>

        {/* Add song modal */}
        {isAddModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={closeAddModal}
          >
            <div
              className="w-full max-w-sm rounded-xl border border-edge bg-surface p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-4 text-base font-bold text-ink">Add Song</h2>
              <form onSubmit={handleAddToList} className="space-y-3">
                <input
                  type="text"
                  placeholder="Song title"
                  value={songName}
                  onChange={(e) => setSongName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-edge px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Artist"
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-edge px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  className="w-full rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isSubmittingAdd ? 'Adding...' : 'Add to list'}
                </button>
                <button
                  type="button"
                  disabled={!songName.trim() || !artistName.trim() || friends.length === 0}
                  onClick={handleOpenFriendSelect}
                  className="w-full rounded-lg border border-cta px-4 py-2 text-sm font-semibold text-cta disabled:opacity-40"
                >
                  Send to friend
                </button>
                {friends.length === 0 && (
                  <p className="text-center text-xs text-ink-3">Add friends to send recommendations.</p>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Friend select modal */}
        {isFriendSelectModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => { setIsFriendSelectModalOpen(false); setSongName(''); setArtistName('') }}
          >
            <div
              className="w-full max-w-sm rounded-xl border border-edge bg-surface p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-4 text-base font-bold text-ink">Send to Friend</h2>
              <div className="space-y-2">
                {friends.map((friend) => (
                  <button
                    key={friend.userId}
                    type="button"
                    onClick={() => setSelectedFriendUserId(friend.userId)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors ${
                      selectedFriendUserId === friend.userId
                        ? 'border-cta bg-cta text-white'
                        : 'border-edge text-ink'
                    }`}
                  >
                    {getFriendDisplayName(friend.username, friend.friendCode)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={!selectedFriendUserId || isSubmittingSend}
                onClick={handleSendToFriend}
                className="mt-4 w-full rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isSubmittingSend ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        )}

        {isLoading && (
          <p className="mt-6 rounded-lg bg-surface p-4 text-sm text-ink">Loading...</p>
        )}

        {!isLoading && unifiedList.length === 0 && (
          <p className="mt-6 rounded-lg bg-surface p-4 text-sm text-ink">No songs yet</p>
        )}

        {!isLoading && unifiedList.length > 0 && (
          <section className="mt-6 space-y-2">
            {unifiedList.map((item) => (
              <article
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-edge bg-surface px-3 py-2 shadow-sm"
              >
                <p className="truncate text-sm text-ink">
                  <span className="font-semibold">{item.songName}</span>
                  {' by '}
                  {item.artistName}
                  {item.kind === 'recommendation' && (
                    <span className="text-ink-3"> · from {item.senderName}</span>
                  )}
                </p>

                <button
                  type="button"
                  onClick={() => handleListened(item)}
                  disabled={removingItemId !== null}
                  className="shrink-0 rounded-lg bg-cta px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {removingItemId === item.id ? 'Removing...' : 'Listened'}
                </button>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}

export default ToListenPage
