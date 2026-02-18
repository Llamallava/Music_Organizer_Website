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

        <h1 className="mt-5 text-3xl font-black text-slate-900">Friends</h1>
        <p className="mt-2 text-sm text-slate-700">
          Share your friend code to connect and track your current friend list.
        </p>

        {isLoading && <p className="mt-6 rounded-lg bg-white p-4 text-sm text-slate-700">Loading friends...</p>}

        {!isLoading && errorMessage && (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <p>Could not load friends.</p>
            <p className="mt-1">{errorMessage}</p>
          </div>
        )}

        {!isLoading && !errorMessage && friendsOverview && (
          <>
            <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Your Friend Code</p>
              <p className="mt-3 text-4xl font-black tracking-wider text-slate-900">
                {friendsOverview.myFriendCode}
              </p>
            </section>

            <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Add Friend by Code</h2>
              <form onSubmit={handleAddFriend} className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={friendCodeInput}
                  onChange={(event) => setFriendCodeInput(event.target.value.toUpperCase())}
                  placeholder="Enter friend code"
                  disabled={isSubmitting}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase tracking-wide"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isSubmitting ? 'Checking...' : 'Add Friend'}
                </button>
              </form>

              {submitMessage && (
                <p className="mt-3 text-sm text-slate-700">
                  {submitMessage}
                </p>
              )}
            </section>

            <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Current Friends</h2>

              {friendsOverview.friends.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">No friends added yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {friendsOverview.friends.map((friend) => (
                    <li key={friend.userId}>
                      <div className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/friends/${friend.userId}`)}
                          className="flex min-w-0 flex-1 items-center justify-between rounded-md px-2 py-1 text-left transition hover:bg-slate-100"
                        >
                          <span className="truncate pr-4 text-sm font-semibold text-slate-900">
                            {getDisplayName(friend.username)}
                          </span>
                          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            {friend.friendCode}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingFriendToRemove(friend)}
                          className="shrink-0 rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
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
            className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="confirm-add-friend-title" className="text-lg font-bold text-slate-900">
              Add this friend?
            </h2>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{getDisplayName(pendingFriend.username)}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                {pendingFriend.friendCode}
              </p>
            </div>

            {isPendingFriendAlreadyAdded && (
              <p className="mt-3 text-sm text-slate-700">This user is already in your friends list.</p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingFriend(null)}
                disabled={isConfirmingAdd}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAddFriend}
                disabled={isConfirmingAdd || isPendingFriendAlreadyAdded}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isConfirmingAdd ? 'Adding...' : 'Confirm Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingFriendToRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
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
            className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="confirm-remove-friend-title" className="text-lg font-bold text-slate-900">
              Remove this friend?
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              You can add them back later with their friend code.
            </p>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">
                {getDisplayName(pendingFriendToRemove.username)}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                {pendingFriendToRemove.friendCode}
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingFriendToRemove(null)}
                disabled={isConfirmingRemove}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveFriend}
                disabled={isConfirmingRemove}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-rose-300"
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
