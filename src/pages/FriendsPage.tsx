import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LinearBackButton from '../components/LinearBackButton'
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
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <LinearBackButton />

        <h1 className="mt-5 text-3xl font-black text-ink">Friends</h1>
        <p className="mt-2 text-sm text-ink">
          Share your friend code to connect and track your current friend list.
        </p>

        {isLoading && <p className="mt-6 rounded-lg bg-surface p-4 text-sm text-ink">Loading friends...</p>}

        {!isLoading && errorMessage && (
          <div className="mt-6 rounded-lg border border-err-edge bg-err-bg p-4 text-sm text-err">
            <p>Could not load friends.</p>
            <p className="mt-1">{errorMessage}</p>
          </div>
        )}

        {!isLoading && !errorMessage && friendsOverview && (
          <>
            <section className="mt-6 rounded-xl border border-edge bg-surface p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-ink-3">Your Friend Code</p>
              <p className="mt-3 text-4xl font-black tracking-wider text-ink">
                {friendsOverview.myFriendCode}
              </p>
            </section>

            <section className="mt-4 rounded-xl border border-edge bg-surface p-5 shadow-sm">
              <h2 className="text-lg font-bold text-ink">Add Friend by Code</h2>
              <form onSubmit={handleAddFriend} className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={friendCodeInput}
                  onChange={(event) => setFriendCodeInput(event.target.value.toUpperCase())}
                  placeholder="Enter friend code"
                  disabled={isSubmitting}
                  className="w-full rounded-md border border-edge px-3 py-2 text-sm uppercase tracking-wide"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Checking...' : 'Add Friend'}
                </button>
              </form>

              {submitMessage && (
                <p className="mt-3 text-sm text-ink">
                  {submitMessage}
                </p>
              )}
            </section>

            <section className="mt-4 rounded-xl border border-edge bg-surface p-5 shadow-sm">
              <h2 className="text-lg font-bold text-ink">Current Friends</h2>

              {friendsOverview.friends.length === 0 ? (
                <p className="mt-3 text-sm text-ink-2">No friends added yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {friendsOverview.friends.map((friend) => (
                    <li key={friend.userId}>
                      <div className="flex items-center gap-2 rounded-md bg-surface-2 px-2 py-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/friends/${friend.userId}`)}
                          className="flex min-w-0 flex-1 items-center justify-between rounded-md px-2 py-1 text-left transition hover:bg-surface-3"
                        >
                          <span className="truncate pr-4 text-sm font-semibold text-ink">
                            {getDisplayName(friend.username)}
                          </span>
                          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-2">
                            {friend.friendCode}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingFriendToRemove(friend)}
                          className="shrink-0 rounded-md border border-err-edge bg-err-bg px-3 py-1.5 text-xs font-semibold text-err transition hover:bg-err-bg/80"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
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
            className="w-full max-w-sm rounded-xl border border-edge bg-surface p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="confirm-add-friend-title" className="text-lg font-bold text-ink">
              Add this friend?
            </h2>

            <div className="mt-4 rounded-lg border border-edge bg-surface-2 px-4 py-3">
              <p className="text-sm font-semibold text-ink">{getDisplayName(pendingFriend.username)}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-2">
                {pendingFriend.friendCode}
              </p>
            </div>

            {isPendingFriendAlreadyAdded && (
              <p className="mt-3 text-sm text-ink">This user is already in your friends list.</p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingFriend(null)}
                disabled={isConfirmingAdd}
                className="rounded-lg border border-edge px-4 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAddFriend}
                disabled={isConfirmingAdd || isPendingFriendAlreadyAdded}
                className="rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isConfirmingAdd ? 'Adding...' : 'Confirm Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingFriendToRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
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
            className="w-full max-w-sm rounded-xl border border-edge bg-surface p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="confirm-remove-friend-title" className="text-lg font-bold text-ink">
              Remove this friend?
            </h2>
            <p className="mt-2 text-sm text-ink">
              You can add them back later with their friend code.
            </p>

            <div className="mt-4 rounded-lg border border-edge bg-surface-2 px-4 py-3">
              <p className="text-sm font-semibold text-ink">
                {getDisplayName(pendingFriendToRemove.username)}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-2">
                {pendingFriendToRemove.friendCode}
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingFriendToRemove(null)}
                disabled={isConfirmingRemove}
                className="rounded-lg border border-edge px-4 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveFriend}
                disabled={isConfirmingRemove}
                className="rounded-lg bg-err-edge px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
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
