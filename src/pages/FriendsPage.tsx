import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  addFriendByCodeForCurrentUser,
  getFriendsOverviewForCurrentUser,
  lookupFriendByCodeForCurrentUser,
  removeFriendForCurrentUser,
  type FriendProfile,
  type FriendsOverview,
} from '../lib/db/friendsData'

const getDisplayName = (username: string | null | undefined) => {
  const trimmedName = username?.trim()
  return trimmedName ? trimmedName : 'Unnamed User'
}

const BACKDROP: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 50,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '0 16px',
  background: 'rgba(8,6,18,0.8)',
  backdropFilter: 'blur(4px)',
}

function FriendsPage() {
  const navigate = useNavigate()
  const [friendsOverview, setFriendsOverview] = useState<FriendsOverview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [friendCodeInput, setFriendCodeInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isConfirmingAdd, setIsConfirmingAdd] = useState(false)
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)
  const [pendingFriend, setPendingFriend] = useState<FriendProfile | null>(null)
  const [pendingFriendToRemove, setPendingFriendToRemove] = useState<FriendProfile | null>(null)
  const isPendingFriendAlreadyAdded = pendingFriend
    ? (friendsOverview?.friends.some((friend) => friend.userId === pendingFriend.userId) ?? false)
    : false

  useEffect(() => {
    let isActive = true

    const loadOverview = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const nextOverview = await getFriendsOverviewForCurrentUser()
        if (!isActive) {
          return
        }

        setFriendsOverview(nextOverview)
      } catch (error) {
        if (!isActive) {
          return
        }

        const message = error instanceof Error ? error.message : 'Failed to load friends.'
        setErrorMessage(message)
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadOverview()

    return () => {
      isActive = false
    }
  }, [])

  const handleAddFriend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setIsSubmitting(true)
    setSubmitMessage(null)

    try {
      const friendCandidate = await lookupFriendByCodeForCurrentUser(friendCodeInput)
      setPendingFriend(friendCandidate)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add friend.'
      setSubmitMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmAddFriend = async () => {
    if (!pendingFriend || isPendingFriendAlreadyAdded) {
      return
    }

    setIsConfirmingAdd(true)
    setSubmitMessage(null)

    try {
      await addFriendByCodeForCurrentUser(pendingFriend.friendCode)

      const nextOverview = await getFriendsOverviewForCurrentUser()
      setFriendsOverview(nextOverview)
      setFriendCodeInput('')
      setPendingFriend(null)
      setSubmitMessage('Friend added.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add friend.'
      setSubmitMessage(message)
    } finally {
      setIsConfirmingAdd(false)
    }
  }

  const handleConfirmRemoveFriend = async () => {
    if (!pendingFriendToRemove) {
      return
    }

    setIsConfirmingRemove(true)
    setSubmitMessage(null)

    try {
      await removeFriendForCurrentUser(pendingFriendToRemove.userId)
      const nextOverview = await getFriendsOverviewForCurrentUser()
      setFriendsOverview(nextOverview)
      setPendingFriendToRemove(null)
      setSubmitMessage('Friend removed.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove friend.'
      setSubmitMessage(message)
    } finally {
      setIsConfirmingRemove(false)
    }
  }

  return (
    <main className="page-wrap" style={{ minHeight: 'unset', height: 'calc(100vh - var(--nav-h))', overflowY: 'auto' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 className="page-title">Friends</h1>

        {isLoading && <p className="vco-loading">Loading friends...</p>}

        {!isLoading && errorMessage && (
          <div className="vco-msg-err" style={{ marginTop: 20 }}>
            Could not load friends. {errorMessage}
          </div>
        )}

        {!isLoading && !errorMessage && friendsOverview && (
          <>
            <section className="vco-panel" style={{ marginTop: 20, padding: '16px 20px' }}>
              <p className="vco-label">Your Friend Code</p>
              <p style={{ marginTop: 10, fontSize: 32, fontWeight: 900, letterSpacing: '0.1em', color: '#ede9fe', fontFamily: "'JetBrains Mono', monospace" }}>
                {friendsOverview.myFriendCode}
              </p>
            </section>

            <section className="vco-panel" style={{ marginTop: 12, padding: '16px 20px' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#ede9fe', fontFamily: "'Sora', sans-serif", marginBottom: 12 }}>
                Add Friend by Code
              </p>
              <form onSubmit={handleAddFriend} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="text"
                    value={friendCodeInput}
                    onChange={(event) => setFriendCodeInput(event.target.value.toUpperCase())}
                    placeholder="Enter friend code"
                    disabled={isSubmitting}
                    style={{
                      flex: 1,
                      borderRadius: 6,
                      border: '1px solid #2a2548',
                      padding: '8px 12px',
                      fontSize: 13,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="vco-tbtn primary"
                  >
                    {isSubmitting ? 'Checking...' : 'Add Friend'}
                  </button>
                </div>

                {submitMessage && (
                  <p style={{ fontSize: 12, color: '#7c6fad', fontFamily: "'JetBrains Mono', monospace" }}>
                    {submitMessage}
                  </p>
                )}
              </form>
            </section>

            <section className="vco-panel" style={{ marginTop: 12, padding: '16px 20px' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#ede9fe', fontFamily: "'Sora', sans-serif", marginBottom: 12 }}>
                Current Friends
              </p>

              {friendsOverview.friends.length === 0 ? (
                <p style={{ fontSize: 13, color: '#7c6fad' }}>No friends added yet.</p>
              ) : (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {friendsOverview.friends.map((friend) => (
                    <li key={friend.userId}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 6, background: '#1c1836', padding: '8px 10px' }}>
                        <button
                          type="button"
                          onClick={() => navigate(`/friends/${friend.userId}`)}
                          style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 4 }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#ede9fe', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>
                            {getDisplayName(friend.username)}
                          </span>
                          <span className="vco-label" style={{ flexShrink: 0 }}>
                            {friend.friendCode}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingFriendToRemove(friend)}
                          className="vco-tbtn vco-tbtn-danger"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      {pendingFriend && (
        <div
          style={BACKDROP}
          onClick={() => {
            if (!isConfirmingAdd) {
              setPendingFriend(null)
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-add-friend-title"
            className="vco-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="confirm-add-friend-title" className="vco-modal-title">
              Add this friend?
            </h2>

            <div className="vco-modal-info">
              <p className="vco-modal-item-title">{getDisplayName(pendingFriend.username)}</p>
              <p className="vco-modal-item-type">{pendingFriend.friendCode}</p>
            </div>

            {isPendingFriendAlreadyAdded && (
              <p style={{ fontSize: 12, color: '#7c6fad', marginBottom: 10 }}>
                This user is already in your friends list.
              </p>
            )}

            <div className="vco-modal-actions">
              <button
                type="button"
                onClick={() => setPendingFriend(null)}
                disabled={isConfirmingAdd}
                className="vco-tbtn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmAddFriend()}
                disabled={isConfirmingAdd || isPendingFriendAlreadyAdded}
                className="vco-tbtn primary"
              >
                {isConfirmingAdd ? 'Adding...' : 'Confirm Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingFriendToRemove && (
        <div
          style={BACKDROP}
          onClick={() => {
            if (!isConfirmingRemove) {
              setPendingFriendToRemove(null)
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-remove-friend-title"
            className="vco-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="confirm-remove-friend-title" className="vco-modal-title">
              Remove this friend?
            </h2>
            <p style={{ fontSize: 13, color: '#c4b5fd', marginBottom: 14 }}>
              You can add them back later with their friend code.
            </p>

            <div className="vco-modal-info">
              <p className="vco-modal-item-title">{getDisplayName(pendingFriendToRemove.username)}</p>
              <p className="vco-modal-item-type">{pendingFriendToRemove.friendCode}</p>
            </div>

            <div className="vco-modal-actions">
              <button
                type="button"
                onClick={() => setPendingFriendToRemove(null)}
                disabled={isConfirmingRemove}
                className="vco-tbtn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmRemoveFriend()}
                disabled={isConfirmingRemove}
                className="vco-tbtn vco-tbtn-danger"
              >
                {isConfirmingRemove ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default FriendsPage
