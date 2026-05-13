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
    <main className="page-wrap">
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 className="page-title">Explore</h1>
        <p style={{ marginTop: 6, fontSize: 13, color: '#7c6fad', fontFamily: "'JetBrains Mono', monospace" }}>
          Notifications and activity updates.
        </p>

        {isLoading && <p className="vco-loading">Loading notifications...</p>}

        {!isLoading && errorMessage && (
          <div className="vco-msg-err" style={{ marginTop: 20 }}>
            Could not load notifications. {errorMessage}
          </div>
        )}

        {!isLoading && !errorMessage && notifications.length === 0 && (
          <p className="vco-empty">No notifications yet.</p>
        )}

        {!isLoading && !errorMessage && notifications.length > 0 && (
          <section style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notifications.map((notification) => (
              <article
                key={notification.id}
                className="vco-panel"
                style={{ padding: '14px 16px' }}
              >
                <p style={{ fontSize: 13, fontWeight: 600, color: '#ede9fe' }}>
                  {renderNotificationText(notification)}
                </p>
                <p style={{ marginTop: 6, fontSize: 11, color: '#7c6fad', fontFamily: "'JetBrains Mono', monospace" }}>
                  {formatNotificationTime(notification.createdAt)}
                </p>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}

export default ExplorePage
