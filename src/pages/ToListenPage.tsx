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

type ActiveTab = 'to-listen' | 'recommendations'

const getFriendDisplayName = (username: string | null | undefined, friendCode: string | null | undefined) => {
  const trimmedName = username?.trim()
  if (trimmedName) {
    return trimmedName
  }

  return friendCode ?? 'Unknown User'
}

function ToListenPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('to-listen')
  const [toListenSongs, setToListenSongs] = useState<ToListenSong[]>([])
  const [receivedRecommendations, setReceivedRecommendations] = useState<ReceivedRecommendation[]>([])
  const [friends, setFriends] = useState<FriendProfile[]>([])
  const [toListenSongName, setToListenSongName] = useState('')
  const [toListenArtistName, setToListenArtistName] = useState('')
  const [recommendationSongName, setRecommendationSongName] = useState('')
  const [recommendationArtistName, setRecommendationArtistName] = useState('')
  const [selectedFriendUserId, setSelectedFriendUserId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmittingToListen, setIsSubmittingToListen] = useState(false)
  const [isSubmittingRecommendation, setIsSubmittingRecommendation] = useState(false)
  const [removingToListenSongId, setRemovingToListenSongId] = useState<string | null>(null)
  const [removingRecommendationId, setRemovingRecommendationId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [recommendationSubmitMessage, setRecommendationSubmitMessage] = useState<string | null>(null)

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

        if (!isActive) {
          return
        }

        setToListenSongs(toListenRecords)
        setReceivedRecommendations(recommendationRecords)
        setFriends(friendsOverview.friends)
        setSelectedFriendUserId((previous) => previous || friendsOverview.friends[0]?.userId || '')
      } catch (error) {
        if (!isActive) {
          return
        }

        const message =
          error instanceof Error ? error.message : 'Failed to load to-listen/recommendation data.'
        setErrorMessage(message)
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      isActive = false
    }
  }, [])

  const handleAddToListen = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmittingToListen(true)

    try {
      const addedSong = await addToListenSongForCurrentUser({
        songName: toListenSongName,
        artistName: toListenArtistName,
      })

      setToListenSongs((previous) => [addedSong, ...previous])
      setToListenSongName('')
      setToListenArtistName('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add song.'
      setErrorMessage(message)
    } finally {
      setIsSubmittingToListen(false)
    }
  }

  const handleMarkToListenListened = async (songId: string) => {
    setErrorMessage(null)
    setRemovingToListenSongId(songId)

    try {
      await removeToListenSongForCurrentUser(songId)
      setToListenSongs((previous) => previous.filter((song) => song.id !== songId))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove song.'
      setErrorMessage(message)
    } finally {
      setRemovingToListenSongId(null)
    }
  }

  const handleSendRecommendation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setRecommendationSubmitMessage(null)
    setIsSubmittingRecommendation(true)

    try {
      await sendRecommendationForCurrentUser({
        friendUserId: selectedFriendUserId,
        songName: recommendationSongName,
        artistName: recommendationArtistName,
      })

      setRecommendationSongName('')
      setRecommendationArtistName('')
      setRecommendationSubmitMessage('Recommendation sent.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send recommendation.'
      setErrorMessage(message)
    } finally {
      setIsSubmittingRecommendation(false)
    }
  }

  const handleMarkRecommendationListened = async (recommendationId: string) => {
    setErrorMessage(null)
    setRemovingRecommendationId(recommendationId)

    try {
      await removeReceivedRecommendationForCurrentUser(recommendationId)
      setReceivedRecommendations((previous) => previous.filter((item) => item.id !== recommendationId))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove recommendation.'
      setErrorMessage(message)
    } finally {
      setRemovingRecommendationId(null)
    }
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <LinearBackButton />

        <h1 className="mt-5 text-3xl font-black text-slate-900">To-Listen</h1>
        <p className="mt-2 text-sm text-slate-700">
          Track songs for yourself and send recommendations directly to friends.
        </p>

        <div className="mt-6 inline-flex rounded-lg border border-slate-300 bg-white p-1">
          <button
            type="button"
            onClick={() => setActiveTab('to-listen')}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${
              activeTab === 'to-listen' ? 'bg-slate-900 text-white' : 'text-slate-700'
            }`}
          >
            To-Listen
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('recommendations')}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${
              activeTab === 'recommendations' ? 'bg-slate-900 text-white' : 'text-slate-700'
            }`}
          >
            Recommendations
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        )}

        {activeTab === 'to-listen' && (
          <>
            <form
              onSubmit={handleAddToListen}
              className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm font-semibold text-slate-800">
                  Song Name
                  <input
                    type="text"
                    value={toListenSongName}
                    onChange={(event) => setToListenSongName(event.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm font-semibold text-slate-800">
                  Artist Name
                  <input
                    type="text"
                    value={toListenArtistName}
                    onChange={(event) => setToListenArtistName(event.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmittingToListen}
                className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isSubmittingToListen ? 'Adding...' : 'Add to List'}
              </button>
            </form>

            {isLoading && (
              <p className="mt-6 rounded-lg bg-white p-4 text-sm text-slate-700">Loading to-listen songs...</p>
            )}

            {!isLoading && toListenSongs.length === 0 && (
              <p className="mt-6 rounded-lg bg-white p-4 text-sm text-slate-700">
                Your to-listen list is empty. Add a song above.
              </p>
            )}

            {!isLoading && toListenSongs.length > 0 && (
              <section className="mt-6 space-y-3">
                {toListenSongs.map((song) => (
                  <article
                    key={song.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-slate-900">{song.songName}</p>
                      <p className="truncate text-sm text-slate-700">{song.artistName}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleMarkToListenListened(song.id)}
                      disabled={removingToListenSongId !== null}
                      className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {removingToListenSongId === song.id ? 'Removing...' : 'Listened to it'}
                    </button>
                  </article>
                ))}
              </section>
            )}
          </>
        )}

        {activeTab === 'recommendations' && (
          <>
            <form
              onSubmit={handleSendRecommendation}
              className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-sm font-semibold text-slate-800">
                  Song Name
                  <input
                    type="text"
                    value={recommendationSongName}
                    onChange={(event) => setRecommendationSongName(event.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm font-semibold text-slate-800">
                  Artist Name
                  <input
                    type="text"
                    value={recommendationArtistName}
                    onChange={(event) => setRecommendationArtistName(event.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm font-semibold text-slate-800">
                  Send To
                  <select
                    value={selectedFriendUserId}
                    onChange={(event) => setSelectedFriendUserId(event.target.value)}
                    disabled={friends.length === 0}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {friends.length === 0 && <option value="">No friends available</option>}
                    {friends.map((friend) => (
                      <option key={friend.userId} value={friend.userId}>
                        {getFriendDisplayName(friend.username, friend.friendCode)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmittingRecommendation || friends.length === 0}
                className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isSubmittingRecommendation ? 'Sending...' : 'Send Recommendation'}
              </button>

              {friends.length === 0 && (
                <p className="mt-3 text-sm text-slate-700">
                  Add at least one friend before sending recommendations.
                </p>
              )}
            </form>

            {recommendationSubmitMessage && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                {recommendationSubmitMessage}
              </div>
            )}

            {isLoading && (
              <p className="mt-6 rounded-lg bg-white p-4 text-sm text-slate-700">
                Loading recommendations...
              </p>
            )}

            {!isLoading && receivedRecommendations.length === 0 && (
              <p className="mt-6 rounded-lg bg-white p-4 text-sm text-slate-700">
                No recommendations yet.
              </p>
            )}

            {!isLoading && receivedRecommendations.length > 0 && (
              <section className="mt-6 space-y-3">
                {receivedRecommendations.map((recommendation) => (
                  <article
                    key={recommendation.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-slate-900">
                        {recommendation.songName}
                      </p>
                      <p className="truncate text-sm text-slate-700">{recommendation.artistName}</p>
                      <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">
                        From {getFriendDisplayName(recommendation.senderUsername, recommendation.senderFriendCode)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleMarkRecommendationListened(recommendation.id)}
                      disabled={removingRecommendationId !== null}
                      className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {removingRecommendationId === recommendation.id ? 'Removing...' : 'Listened to it'}
                    </button>
                  </article>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default ToListenPage
