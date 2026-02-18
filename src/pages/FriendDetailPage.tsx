import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import LinearBackButton from '../components/LinearBackButton'
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
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <LinearBackButton />

        <h1 className="mt-5 text-3xl font-black text-slate-900">Friend Profile</h1>

        {isLoading && <p className="mt-6 rounded-lg bg-white p-4 text-sm text-slate-700">Loading friend...</p>}

        {!isLoading && errorMessage && (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <p>Could not load friend.</p>
            <p className="mt-1">{errorMessage}</p>
          </div>
        )}

        {!isLoading && !errorMessage && !friend && (
          <p className="mt-6 rounded-lg bg-white p-4 text-sm text-slate-700">
            This friend is not in your current list.
          </p>
        )}

        {!isLoading && !errorMessage && friend && (
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-3xl font-black text-slate-900">{displayName}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Friend Code: {friend.friendCode}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                onClick={() => navigate(`/friends/${friend.userId}/reviews`)}
              >
                Read {toPossessiveName(displayName)} Reviews
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
                onClick={() => navigate(`/friends/${friend.userId}/stats`)}
              >
                See {toPossessiveName(displayName)} Stats
              </button>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => {
                  setRemoveErrorMessage(null)
                  setIsRemoveDialogOpen(true)
                }}
                className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                Remove Friend
              </button>
            </div>

            {removeErrorMessage && (
              <p className="mt-3 text-sm text-rose-700">{removeErrorMessage}</p>
            )}
          </section>
        )}
      </div>

      {isRemoveDialogOpen && friend && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
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
            className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="confirm-remove-friend-title" className="text-lg font-bold text-slate-900">
              Remove this friend?
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              You can always add them again later with their friend code.
            </p>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{displayName}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                {friend.friendCode}
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRemoveDialogOpen(false)}
                disabled={isRemoving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveFriend}
                disabled={isRemoving}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-rose-300"
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
