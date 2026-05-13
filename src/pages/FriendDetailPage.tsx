import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getFriendsOverviewForCurrentUser,
  removeFriendForCurrentUser,
  type FriendProfile,
} from '../lib/db/friendsData'

const getDisplayName = (username: string | null | undefined) => {
  const trimmedName = username?.trim()
  return trimmedName ? trimmedName : 'Unnamed User'
}

const toPossessiveName = (name: string) => {
  if (name.endsWith('s') || name.endsWith('S')) {
    return `${name}'`
  }

  return `${name}'s`
}

const BACKDROP: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 50,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '0 16px',
  background: 'rgba(8,6,18,0.8)',
  backdropFilter: 'blur(4px)',
}

function FriendDetailPage() {
  const navigate = useNavigate()
  const { friendUserId } = useParams<{ friendUserId: string }>()
  const [friend, setFriend] = useState<FriendProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [removeErrorMessage, setRemoveErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    const loadFriend = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      if (!friendUserId) {
        setFriend(null)
        setErrorMessage('Missing friend identifier.')
        setIsLoading(false)
        return
      }

      try {
        const overview = await getFriendsOverviewForCurrentUser()
        if (!isActive) {
          return
        }

        const selectedFriend = overview.friends.find((entry) => entry.userId === friendUserId) ?? null
        setFriend(selectedFriend)
      } catch (error) {
        if (!isActive) {
          return
        }

        const message = error instanceof Error ? error.message : 'Failed to load friend.'
        setErrorMessage(message)
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadFriend()

    return () => {
      isActive = false
    }
  }, [friendUserId])

  const displayName = getDisplayName(friend?.username)

  const handleConfirmRemoveFriend = async () => {
    if (!friend) {
      return
    }

    setIsRemoving(true)
    setRemoveErrorMessage(null)

    try {
      await removeFriendForCurrentUser(friend.userId)
      navigate('/friends')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove friend.'
      setRemoveErrorMessage(message)
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <main className="page-wrap">
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 className="page-title">Friend Profile</h1>

        {isLoading && <p className="vco-loading">Loading friend...</p>}

        {!isLoading && errorMessage && (
          <div className="vco-msg-err" style={{ marginTop: 20 }}>
            {errorMessage}
          </div>
        )}

        {!isLoading && !errorMessage && !friend && (
          <p className="vco-empty">This friend is not in your current list.</p>
        )}

        {!isLoading && !errorMessage && friend && (
          <section className="vco-panel" style={{ marginTop: 20, padding: '20px 24px' }}>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#ede9fe', fontFamily: "'Sora', sans-serif" }}>
              {displayName}
            </p>
            <p className="vco-label" style={{ marginTop: 6 }}>
              Friend Code: {friend.friendCode}
            </p>

            <div style={{ marginTop: 20, display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
              <button
                type="button"
                className="vco-tbtn primary"
                onClick={() => navigate(`/friends/${friend.userId}/reviews`)}
              >
                {toPossessiveName(displayName)} Reviews
              </button>
              <button
                type="button"
                className="vco-tbtn"
                onClick={() => navigate(`/friends/${friend.userId}/stats`)}
              >
                {toPossessiveName(displayName)} Stats
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={() => {
                  setRemoveErrorMessage(null)
                  setIsRemoveDialogOpen(true)
                }}
                className="vco-tbtn vco-tbtn-danger"
              >
                Remove Friend
              </button>
            </div>

            {removeErrorMessage && (
              <div className="vco-msg-err" style={{ marginTop: 12 }}>
                {removeErrorMessage}
              </div>
            )}
          </section>
        )}
      </div>

      {isRemoveDialogOpen && friend && (
        <div
          style={BACKDROP}
          onClick={() => {
            if (!isRemoving) {
              setIsRemoveDialogOpen(false)
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
              You can always add them again later with their friend code.
            </p>

            <div className="vco-modal-info">
              <p className="vco-modal-item-title">{displayName}</p>
              <p className="vco-modal-item-type">{friend.friendCode}</p>
            </div>

            <div className="vco-modal-actions">
              <button
                type="button"
                onClick={() => setIsRemoveDialogOpen(false)}
                disabled={isRemoving}
                className="vco-tbtn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmRemoveFriend()}
                disabled={isRemoving}
                className="vco-tbtn vco-tbtn-danger"
              >
                {isRemoving ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default FriendDetailPage
