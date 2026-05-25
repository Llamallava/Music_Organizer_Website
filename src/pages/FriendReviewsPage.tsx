import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AlbumCover from '../components/AlbumCover'
import { StellarHorizon } from '../components/StellarHorizon'
import { getFriendsOverviewForCurrentUser } from '../lib/db/friendsData'
import { listSavedAlbumsForUser, type SavedAlbumCard } from '../lib/db/reviewsData'

const getDisplayName = (username: string | null | undefined) => username?.trim() || 'Unnamed User'
const toPossessiveName = (name: string) => (name.endsWith('s') || name.endsWith('S') ? `${name}'` : `${name}'s`)

function FriendReviewsPage() {
  const navigate = useNavigate()
  const { friendUserId } = useParams<{ friendUserId: string }>()
  const [friendName, setFriendName] = useState<string | null>(null)
  const [albums, setAlbums] = useState<SavedAlbumCard[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    const loadFriendReviews = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      if (!friendUserId) {
        setFriendName(null)
        setAlbums([])
        setErrorMessage('Missing friend identifier.')
        setIsLoading(false)
        return
      }

      try {
        const [overview, savedAlbums] = await Promise.all([
          getFriendsOverviewForCurrentUser(),
          listSavedAlbumsForUser(friendUserId),
        ])
        if (!isActive) {
          return
        }

        const friend = overview.friends.find((entry) => entry.userId === friendUserId)
        if (!friend) {
          setFriendName(null)
          setAlbums([])
          setErrorMessage('This friend is not in your current list.')
          return
        }

        setFriendName(getDisplayName(friend.username))
        setAlbums(savedAlbums)
      } catch (error) {
        if (!isActive) {
          return
        }

        const message = error instanceof Error ? error.message : 'Failed to load friend reviews.'
        setErrorMessage(message)
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadFriendReviews()

    return () => {
      isActive = false
    }
  }, [friendUserId])

  return (
    <main className="page-wrap">
      <h1 className="page-title">
        {toPossessiveName(friendName ?? 'Friend')} Reviews
      </h1>

      <StellarHorizon label={`${(friendName ?? 'FRIEND').toUpperCase()}'S LIBRARY`} />

      {isLoading && <p className="vco-loading">Loading albums...</p>}

      {!isLoading && errorMessage && (
        <div className="vco-msg-err" style={{ marginTop: 20 }}>
          {errorMessage}
        </div>
      )}

      {!isLoading && !errorMessage && albums.length === 0 && (
        <p className="vco-empty">{toPossessiveName(friendName ?? 'Friend')} review list is currently empty.</p>
      )}

      {!isLoading && !errorMessage && albums.length > 0 && friendUserId && (
        <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {albums.map((album) => (
            <button
              key={album.userSavedAlbumId}
              type="button"
              onClick={() => navigate(`/friends/${friendUserId}/reviews/${album.userSavedAlbumId}`)}
              className="text-left"
            >
              <div className="aspect-square w-full overflow-hidden rounded-lg bg-surface-2 cover-halo">
                <AlbumCover src={album.coverUrl} alt={`${album.title} cover`} loading="lazy" />
              </div>

              <p className="mt-2 truncate text-sm font-semibold text-ink">{album.title}</p>
              <p className="truncate text-xs text-ink-2">{album.artistName}</p>
            </button>
          ))}
        </section>
      )}
    </main>
  )
}

export default FriendReviewsPage
