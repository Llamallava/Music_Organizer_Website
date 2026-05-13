import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthSession } from '../hooks/useAuthSession'
import { supabase } from '../lib/supabaseClient'
import {
  listExploreNotificationsForCurrentUser,
  type ExploreNotification,
} from '../lib/db/notificationsData'

type AccountMenuView = 'root' | 'details'

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

function AccountMenu() {
  const { user, isLoading } = useAuthSession()
  const navigate = useNavigate()
  const location = useLocation()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isBellOpen, setIsBellOpen] = useState(false)
  const [view, setView] = useState<AccountMenuView>('root')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [profileUsername, setProfileUsername] = useState<string | null>(null)
  const [profileFriendCode, setProfileFriendCode] = useState<string | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  const [isEditingUsername, setIsEditingUsername] = useState(false)
  const [usernameDraft, setUsernameDraft] = useState('')
  const [usernameErrorMessage, setUsernameErrorMessage] = useState<string | null>(null)
  const [usernameInfoMessage, setUsernameInfoMessage] = useState<string | null>(null)
  const [isSavingUsername, setIsSavingUsername] = useState(false)
  const [notifications, setNotifications] = useState<ExploreNotification[]>([])
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false)
  const [notificationsError, setNotificationsError] = useState<string | null>(null)

  useEffect(() => {
    setIsOpen(false)
    setIsBellOpen(false)
    setView('root')
  }, [location.pathname])

  useEffect(() => {
    if (!isOpen && !isBellOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) {
        return
      }

      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false)
        setIsBellOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        setIsBellOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isBellOpen])

  useEffect(() => {
    if (!user) {
      setIsOpen(false)
      setIsBellOpen(false)
      setView('root')
      setIsLoggingOut(false)
      setIsEditingUsername(false)
      setUsernameDraft('')
      setUsernameErrorMessage(null)
      setUsernameInfoMessage(null)
      setIsSavingUsername(false)
    }
  }, [user])

  useEffect(() => {
    if (!isOpen) {
      setView('root')
      setIsEditingUsername(false)
      setUsernameDraft('')
      setUsernameErrorMessage(null)
      setUsernameInfoMessage(null)
    }
  }, [isOpen])

  useEffect(() => {
    if (!user) {
      setProfileUsername(null)
      setProfileFriendCode(null)
      setIsLoadingProfile(false)
      return
    }

    let isActive = true

    const loadProfile = async () => {
      setIsLoadingProfile(true)

      const { data, error } = await supabase
        .from('profiles')
        .select('username, friend_code')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!isActive) {
        return
      }

      if (error || !data) {
        setProfileUsername(null)
        setProfileFriendCode(null)
        setIsLoadingProfile(false)
        return
      }

      setProfileUsername(data.username)
      setProfileFriendCode(data.friend_code)
      setIsLoadingProfile(false)
    }

    void loadProfile()

    return () => {
      isActive = false
    }
  }, [user])

  useEffect(() => {
    if (!isBellOpen) {
      return
    }

    let isActive = true

    const loadNotifications = async () => {
      setIsLoadingNotifications(true)
      setNotificationsError(null)

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
        setNotificationsError(
          error instanceof Error ? error.message : 'Failed to load notifications.',
        )
      } finally {
        if (isActive) {
          setIsLoadingNotifications(false)
        }
      }
    }

    void loadNotifications()

    return () => {
      isActive = false
    }
  }, [isBellOpen])

  const handleLogOut = async () => {
    if (isLoggingOut) {
      return
    }

    setIsLoggingOut(true)
    const { error } = await supabase.auth.signOut()
    setIsLoggingOut(false)
    setIsOpen(false)

    if (!error) {
      navigate('/auth', { replace: true })
    }
  }

  if (isLoading || !user) {
    return null
  }

  const metadataUsername =
    typeof user.user_metadata?.username === 'string' ? user.user_metadata.username.trim() : ''
  const accountUsername = profileUsername?.trim() || metadataUsername || 'Not set'

  const handleStartUsernameEdit = () => {
    if (isLoadingProfile || isSavingUsername) {
      return
    }

    setUsernameDraft(accountUsername === 'Not set' ? '' : accountUsername)
    setUsernameErrorMessage(null)
    setUsernameInfoMessage(null)
    setIsEditingUsername(true)
  }

  const handleCancelUsernameEdit = () => {
    if (isSavingUsername) {
      return
    }

    setIsEditingUsername(false)
    setUsernameDraft('')
    setUsernameErrorMessage(null)
  }

  const handleSaveUsername = async () => {
    if (isSavingUsername) {
      return
    }

    const trimmedUsername = usernameDraft.trim()
    if (trimmedUsername.length < 3 || trimmedUsername.length > 32) {
      setUsernameErrorMessage('Username must be between 3 and 32 characters.')
      return
    }

    setIsSavingUsername(true)
    setUsernameErrorMessage(null)
    setUsernameInfoMessage(null)

    const { error: updateProfileError } = await supabase.rpc('update_my_username', {
      next_username: trimmedUsername,
    })

    if (updateProfileError) {
      const isUsernameTaken =
        updateProfileError.code === '23505' ||
        updateProfileError.message.toLowerCase().includes('duplicate key value')
      setUsernameErrorMessage(
        isUsernameTaken
          ? 'That username is already in use.'
          : `Failed to update username: ${updateProfileError.message}`,
      )
      setIsSavingUsername(false)
      return
    }

    const { error: authUpdateError } = await supabase.auth.updateUser({
      data: {
        username: trimmedUsername,
      },
    })

    setProfileUsername(trimmedUsername)
    setIsEditingUsername(false)
    setUsernameDraft('')
    setIsSavingUsername(false)

    if (authUpdateError) {
      setUsernameInfoMessage('Username updated.')
      return
    }

    setUsernameInfoMessage('Username updated.')
  }

  return (
    <div ref={containerRef} className="flex items-center gap-1.5">

      {/* Notification bell */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setIsBellOpen((previous) => !previous)
            setIsOpen(false)
          }}
          className="vco-tbtn"
          aria-label="Open notifications"
          aria-haspopup="dialog"
          aria-expanded={isBellOpen}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            width="14"
            height="14"
            aria-hidden="true"
          >
            <path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm6-6V11a6 6 0 0 0-5-5.92V4a1 1 0 0 0-2 0v1.08A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2Z" />
          </svg>
        </button>

        {isBellOpen && (
          <div className="am-panel" style={{ width: '288px' }}>
            <div className="am-head">Notifications</div>

            {isLoadingNotifications && (
              <p className="am-body-text">Loading...</p>
            )}

            {!isLoadingNotifications && notificationsError && (
              <p className="am-body-text am-err">{notificationsError}</p>
            )}

            {!isLoadingNotifications && !notificationsError && notifications.length === 0 && (
              <p className="am-body-text">No notifications.</p>
            )}

            {!isLoadingNotifications && !notificationsError && notifications.length > 0 && (
              <div className="am-notif-list">
                {notifications.map((notification) => (
                  <div key={notification.id} className="am-notif-item">
                    <p className="am-notif-text">{renderNotificationText(notification)}</p>
                    <p className="am-notif-time">{formatNotificationTime(notification.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Profile button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setIsOpen((previous) => !previous)
            setIsBellOpen(false)
          }}
          className="vco-tbtn"
          aria-label="Open account menu"
          aria-haspopup="menu"
          aria-expanded={isOpen}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            width="14"
            height="14"
            aria-hidden="true"
          >
            <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.971 0-9 2.686-9 6v1h18v-1c0-3.314-4.029-6-9-6Z" />
          </svg>
        </button>

        {isOpen && (
          <div
            role="menu"
            className="am-panel"
            style={{ minWidth: view === 'details' ? '272px' : '152px' }}
          >
            {view === 'root' ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setView('details')}
                  className="am-item"
                >
                  Account Details
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => navigate('/customize')}
                  className="am-item"
                >
                  Customize
                </button>
                <div className="am-divider" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleLogOut()}
                  disabled={isLoggingOut}
                  className="am-item danger"
                >
                  {isLoggingOut ? 'Logging Out...' : 'Log Out'}
                </button>
              </>
            ) : (
              <>
                <div className="am-detail-head">
                  <button
                    type="button"
                    onClick={() => setView('root')}
                    className="vco-tbtn"
                    aria-label="Back to account menu"
                  >
                    ⟨
                  </button>
                  <span className="am-detail-title">Account Details</span>
                </div>

                <div className="am-divider" />

                <div className="am-field">
                  <p className="am-field-label">Username</p>
                  {isEditingUsername ? (
                    <>
                      <input
                        type="text"
                        value={usernameDraft}
                        onChange={(event) => setUsernameDraft(event.target.value)}
                        minLength={3}
                        maxLength={32}
                        className="am-input"
                        autoComplete="username"
                      />
                      <div className="am-field-actions">
                        <button
                          type="button"
                          onClick={() => void handleSaveUsername()}
                          disabled={isSavingUsername}
                          className="vco-tbtn primary"
                        >
                          {isSavingUsername ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelUsernameEdit}
                          disabled={isSavingUsername}
                          className="vco-tbtn"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="am-field-row">
                      <p className="am-field-value">
                        {isLoadingProfile ? 'Loading...' : accountUsername}
                      </p>
                      <button
                        type="button"
                        onClick={handleStartUsernameEdit}
                        disabled={isLoadingProfile || isSavingUsername}
                        className="vco-tbtn"
                        aria-label="Change username"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          width="12"
                          height="12"
                          aria-hidden="true"
                        >
                          <path d="M3 17.25V21h3.75L18.81 8.94l-3.75-3.75L3 17.25Zm18-11.5a1 1 0 0 0 0-1.41l-1.34-1.34a1 1 0 0 0-1.41 0l-1.13 1.13 3.75 3.75L21 5.75Z" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {usernameErrorMessage && (
                    <p className="am-field-err">{usernameErrorMessage}</p>
                  )}
                  {usernameInfoMessage && (
                    <p className="am-field-ok">{usernameInfoMessage}</p>
                  )}
                </div>

                <div className="am-field">
                  <p className="am-field-label">Email</p>
                  <p className="am-field-value">{user.email ?? 'Not set'}</p>
                </div>

                {profileFriendCode && (
                  <div className="am-field">
                    <p className="am-field-label">Friend Code</p>
                    <p className="am-field-value">{profileFriendCode}</p>
                  </div>
                )}

                <div className="am-divider" />

                <button
                  type="button"
                  role="menuitem"
                  disabled
                  className="am-item"
                >
                  Change Password
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled
                  className="am-item"
                >
                  Change Email
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default AccountMenu
