import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import LinearBackButton from '../components/LinearBackButton'
import { getFriendsOverviewForCurrentUser, type FriendProfile } from '../lib/db/friendsData'

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
          </section>
        )}
      </div>
    </main>
  )
}

export default FriendDetailPage
