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
    <div ref={containerRef} className="fixed right-4 top-4 z-50 flex items-center gap-2">
      {/* Notification bell */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setIsBellOpen((previous) => !previous)
            setIsOpen(false)
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-edge bg-surface text-ink shadow-sm"
          aria-label="Open notifications"
          aria-haspopup="dialog"
          aria-expanded={isBellOpen}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm6-6V11a6 6 0 0 0-5-5.92V4a1 1 0 0 0-2 0v1.08A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2Z" />
          </svg>
        </button>

        {isBellOpen && (
          <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-edge bg-surface shadow-lg">
            <div className="border-b border-edge px-4 py-3">
              <h2 className="text-sm font-bold text-ink">Notifications</h2>
            </div>

            {isLoadingNotifications && (
              <p className="px-4 py-3 text-sm text-ink">Loading...</p>
            )}

            {!isLoadingNotifications && notificationsError && (
              <p className="px-4 py-3 text-sm text-err">{notificationsError}</p>
            )}

            {!isLoadingNotifications && !notificationsError && notifications.length === 0 && (
              <p className="px-4 py-3 text-sm text-ink">No notifications yet.</p>
            )}

            {!isLoadingNotifications && !notificationsError && notifications.length > 0 && (
              <div className="max-h-96 divide-y divide-edge overflow-auto">
                {notifications.map((notification) => (
                  <div key={notification.id} className="px-4 py-3">
                    <p className="text-sm font-semibold text-ink">
                      {renderNotificationText(notification)}
                    </p>
                    <p className="mt-1 text-xs text-ink-3">
                      {formatNotificationTime(notification.createdAt)}
                    </p>
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
          className="flex h-11 w-11 items-center justify-center rounded-full border border-edge bg-surface text-ink shadow-sm"
          aria-label="Open account menu"
          aria-haspopup="menu"
          aria-expanded={isOpen}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.971 0-9 2.686-9 6v1h18v-1c0-3.314-4.029-6-9-6Z" />
          </svg>
        </button>

        {isOpen && (
          <div
            role="menu"
            className={`absolute right-0 mt-2 overflow-hidden rounded-xl border border-edge bg-surface p-1 shadow-lg ${
              view === 'details' ? 'w-80' : 'w-44'
            }`}
          >
            {view === 'root' ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setView('details')}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-surface-2"
                >
                  Account Details
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => navigate('/customize')}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-surface-2"
                >
                  Customize
                </button>

                <div className="my-1 border-t border-edge" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleLogOut()}
                  disabled={isLoggingOut}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-err hover:bg-err-bg disabled:opacity-60"
                >
                  {isLoggingOut ? 'Logging Out...' : 'Log Out'}
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1 px-2 py-1">
                  <button
                    type="button"
                    onClick={() => setView('root')}
                    className="rounded-lg px-2 py-1 text-sm font-semibold text-ink hover:bg-surface-2"
                    aria-label="Back to account menu"
                  >
                    Back
                  </button>
                  <p className="text-sm font-semibold text-ink">Account Details</p>
                </div>

                <div className="my-1 border-t border-edge" />

                <div className="px-3 pb-2 pt-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                    Username
                  </p>
                  {isEditingUsername ? (
                    <>
                      <input
                        type="text"
                        value={usernameDraft}
                        onChange={(event) => setUsernameDraft(event.target.value)}
                        minLength={3}
                        maxLength={32}
                        className="mt-1 w-full rounded-md border border-edge px-2 py-1 text-sm"
                        autoComplete="username"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSaveUsername()}
                          disabled={isSavingUsername}
                          className="rounded-md bg-cta px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          {isSavingUsername ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelUsernameEdit}
                          disabled={isSavingUsername}
                          className="rounded-md border border-edge px-2 py-1 text-xs font-semibold text-ink disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="mt-1 flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                        {isLoadingProfile ? 'Loading...' : accountUsername}
                      </p>
                      <button
                        type="button"
                        onClick={handleStartUsernameEdit}
                        disabled={isLoadingProfile || isSavingUsername}
                        className="rounded-md border border-edge p-1 text-ink-2 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Change username"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path d="M3 17.25V21h3.75L18.81 8.94l-3.75-3.75L3 17.25Zm18-11.5a1 1 0 0 0 0-1.41l-1.34-1.34a1 1 0 0 0-1.41 0l-1.13 1.13 3.75 3.75L21 5.75Z" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {usernameErrorMessage && (
                    <p className="mt-2 text-xs font-semibold text-err">
                      {usernameErrorMessage}
                    </p>
                  )}
                  {usernameInfoMessage && (
                    <p className="mt-2 text-xs font-semibold text-ok">
                      {usernameInfoMessage}
                    </p>
                  )}
                </div>

                <div className="px-3 pb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                    Email
                  </p>
                  <p className="mt-1 min-w-0 truncate text-sm text-ink">
                    {user.email ?? 'Not set'}
                  </p>
                </div>

                {profileFriendCode && (
                  <div className="px-3 pb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                      Friend Code
                    </p>
                    <p className="mt-1 min-w-0 truncate text-sm text-ink">
                      {profileFriendCode}
                    </p>
                  </div>
                )}

                <div className="my-1 border-t border-edge" />

                <button
                  type="button"
                  role="menuitem"
                  disabled
                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink-3 disabled:cursor-not-allowed"
                >
                  Change Password
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled
                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink-3 disabled:cursor-not-allowed"
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
