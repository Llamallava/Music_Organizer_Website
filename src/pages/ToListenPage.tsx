import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { StellarHorizon } from '../components/StellarHorizon'
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

const BACKDROP: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 50,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '0 16px',
  background: 'rgba(8,6,18,0.8)',
  backdropFilter: 'blur(4px)',
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  borderRadius: 6,
  border: '1px solid #2a2548',
  padding: '8px 12px',
  fontSize: 13,
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
    <main className="page-wrap">
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 className="page-title">To-Listen</h1>

        {errorMessage && (
          <div className="vco-msg-err" style={{ marginTop: 16 }}>
            {errorMessage}
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="vco-tbtn primary"
          >
            + Add
          </button>
        </div>

        <StellarHorizon label={`QUEUE · ${unifiedList.length} IN ORBIT`} />

        {isLoading && <p className="vco-loading">Loading...</p>}

        {!isLoading && unifiedList.length === 0 && (
          <p className="vco-empty">No songs yet.</p>
        )}

        {!isLoading && unifiedList.length > 0 && (
          <section style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {unifiedList.map((item) => (
              <article
                key={item.id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 6, border: '1px solid #2a2548', background: '#141028', padding: '10px 14px' }}
              >
                <p style={{ fontSize: 13, color: '#ede9fe', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ fontWeight: 600 }}>{item.songName}</span>
                  {' by '}
                  {item.artistName}
                  {item.kind === 'recommendation' && (
                    <span style={{ color: '#7c6fad' }}> · from {item.senderName}</span>
                  )}
                </p>

                <button
                  type="button"
                  onClick={() => void handleListened(item)}
                  disabled={removingItemId !== null}
                  className="vco-tbtn"
                  style={{ flexShrink: 0 }}
                >
                  {removingItemId === item.id ? 'Removing...' : 'Listened'}
                </button>
              </article>
            ))}
          </section>
        )}
      </div>

      {/* Add song modal */}
      {isAddModalOpen && (
        <div style={BACKDROP} onClick={closeAddModal}>
          <div
            className="vco-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="vco-modal-title">Add Song</h2>
            <form onSubmit={handleAddToList} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="text"
                placeholder="Song title"
                value={songName}
                onChange={(e) => setSongName(e.target.value)}
                required
                style={inputStyle}
              />
              <input
                type="text"
                placeholder="Artist"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                required
                style={inputStyle}
              />
              <button
                type="submit"
                disabled={isSubmittingAdd}
                className="vco-tbtn primary"
                style={{ width: '100%' }}
              >
                {isSubmittingAdd ? 'Adding...' : 'Add to list'}
              </button>
              <button
                type="button"
                disabled={!songName.trim() || !artistName.trim() || friends.length === 0}
                onClick={handleOpenFriendSelect}
                className="vco-tbtn"
                style={{ width: '100%' }}
              >
                Send to friend
              </button>
              {friends.length === 0 && (
                <p style={{ textAlign: 'center', fontSize: 11, color: '#7c6fad', fontFamily: "'JetBrains Mono', monospace" }}>
                  Add friends to send recommendations.
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Friend select modal */}
      {isFriendSelectModalOpen && (
        <div
          style={BACKDROP}
          onClick={() => { setIsFriendSelectModalOpen(false); setSongName(''); setArtistName('') }}
        >
          <div
            className="vco-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="vco-modal-title">Send to Friend</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {friends.map((friend) => (
                <button
                  key={friend.userId}
                  type="button"
                  onClick={() => setSelectedFriendUserId(friend.userId)}
                  className={`vco-tbtn${selectedFriendUserId === friend.userId ? ' primary' : ''}`}
                  style={{ width: '100%', textAlign: 'left' }}
                >
                  {getFriendDisplayName(friend.username, friend.friendCode)}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!selectedFriendUserId || isSubmittingSend}
              onClick={() => void handleSendToFriend()}
              className="vco-tbtn primary"
              style={{ width: '100%' }}
            >
              {isSubmittingSend ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

export default ToListenPage
