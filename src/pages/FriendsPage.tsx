import { type FormEvent, useEffect, useState } from 'react'
import LinearBackButton from '../components/LinearBackButton'
import { addFriendByCodeForCurrentUser, getFriendsOverviewForCurrentUser, type FriendsOverview } from '../lib/db/friendsData'

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

function FriendsPage() {
  const [friendsOverview, setFriendsOverview] = useState<FriendsOverview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [friendCodeInput, setFriendCodeInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)
  const [selectedFriendUserId, setSelectedFriendUserId] = useState<string | null>(null)

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
      await addFriendByCodeForCurrentUser(friendCodeInput)

      const nextOverview = await getFriendsOverviewForCurrentUser()
      setFriendsOverview(nextOverview)
      setSelectedFriendUserId(null)
      setFriendCodeInput('')
      setSubmitMessage('Friend added.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add friend.'
      setSubmitMessage(message)
    } finally {
      setIsSubmitting(false)
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
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase tracking-wide"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isSubmitting ? 'Adding...' : 'Add Friend'}
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
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedFriendUserId((currentUserId) =>
                            currentUserId === friend.userId ? null : friend.userId,
                          )
                        }
                        className="flex w-full items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-left transition hover:bg-slate-100"
                      >
                        <span className="truncate pr-4 text-sm font-semibold text-slate-900">
                          {getDisplayName(friend.username)}
                        </span>
                        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-600">
                          {friend.friendCode}
                        </span>
                      </button>

                      {selectedFriendUserId === friend.userId && (
                        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="text-sm font-bold text-slate-900">
                            {getDisplayName(friend.username)}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-wide text-slate-600">
                            Friend Code: {friend.friendCode}
                          </p>
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <button
                              type="button"
                              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                            >
                              Read {toPossessiveName(getDisplayName(friend.username))} Reviews
                            </button>
                            <button
                              type="button"
                              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                            >
                              See {toPossessiveName(getDisplayName(friend.username))} Stats
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}

export default FriendsPage
