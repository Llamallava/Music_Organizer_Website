import { useEffect, useState } from 'react'
import { listExploreNotificationsForCurrentUser, type ExploreNotification } from '../lib/db/notificationsData'

const formatNotificationTime = (isoTimestamp: string) => {
  const parsed = new Date(isoTimestamp)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return parsed.toLocaleString()
}

const renderNotificationText = (notification: ExploreNotification) => {
  if (notification.type === 'recommendation_received') {
    if (notification.isOld) {
      return `You still have a recommendation from ${notification.friendDisplayName}: "${notification.songName}" by ${notification.artistName}.`
    }

    return `${notification.friendDisplayName} sent you "${notification.songName}" by ${notification.artistName}.`
  }

  if (notification.type === 'recommendation_listened') {
    return `${notification.friendDisplayName} listened to "${notification.songName}" by ${notification.artistName}.`
  }

  const songLabel = notification.count === 1 ? 'song' : 'songs'
  return `You have ${notification.count} ${songLabel} in your To-Listen list.`
}

function ExplorePage() {
  const [notifications, setNotifications] = useState<ExploreNotification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    const loadNotifications = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const records = await listExploreNotificationsForCurrentUser()
        if (!isActive) {
          return
        }

        setNotifications(records)
      } catch (error) {
        if (!isActive) {
          return
        }

        const message = error instanceof Error ? error.message : 'Failed to load notifications.'
        setErrorMessage(message)
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadNotifications()

    return () => {
      isActive = false
    }
  }, [])

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-3xl font-black text-slate-900">Explore</h1>
        <p className="mt-2 text-sm text-slate-700">Notifications and activity updates.</p>

        {isLoading && (
          <p className="mt-6 rounded-lg bg-white p-4 text-sm text-slate-700">Loading notifications...</p>
        )}

        {!isLoading && errorMessage && (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <p>Could not load notifications.</p>
            <p className="mt-1">{errorMessage}</p>
          </div>
        )}

        {!isLoading && !errorMessage && notifications.length === 0 && (
          <p className="mt-6 rounded-lg bg-white p-4 text-sm text-slate-700">
            No notifications yet.
          </p>
        )}

        {!isLoading && !errorMessage && notifications.length > 0 && (
          <section className="mt-6 space-y-3">
            {notifications.map((notification) => (
              <article
                key={notification.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-sm font-semibold text-slate-900">{renderNotificationText(notification)}</p>
                <p className="mt-2 text-xs text-slate-500">{formatNotificationTime(notification.createdAt)}</p>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}

export default ExplorePage
