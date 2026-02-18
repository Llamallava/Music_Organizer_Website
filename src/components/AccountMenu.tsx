import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthSession } from '../hooks/useAuthSession'
import { supabase } from '../lib/supabaseClient'

type AccountMenuView = 'root' | 'details'

function AccountMenu() {
  const { user, isLoading } = useAuthSession()
  const navigate = useNavigate()
  const location = useLocation()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
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

  useEffect(() => {
    setIsOpen(false)
    setView('root')
  }, [location.pathname])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) {
        return
      }

      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  useEffect(() => {
    if (!user) {
      setIsOpen(false)
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
        isUsernameTaken ? 'That username is already in use.' : `Failed to update username: ${updateProfileError.message}`,
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
    <div ref={containerRef} className="fixed right-4 top-4 z-50">
      <button
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm"
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
          className={`absolute right-0 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg ${
            view === 'details' ? 'w-80' : 'w-44'
          }`}
        >
          {view === 'root' ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => setView('details')}
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-100"
              >
                Account Details
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-100"
              >
                Customize
              </button>

              <div className="my-1 border-t border-slate-200" />

              <button
                type="button"
                role="menuitem"
                onClick={() => void handleLogOut()}
                disabled={isLoggingOut}
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
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
                  className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  aria-label="Back to account menu"
                >
                  Back
                </button>
                <p className="text-sm font-semibold text-slate-900">Account Details</p>
              </div>

              <div className="my-1 border-t border-slate-200" />

              <div className="px-3 pb-2 pt-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Username</p>
                {isEditingUsername ? (
                  <>
                    <input
                      type="text"
                      value={usernameDraft}
                      onChange={(event) => setUsernameDraft(event.target.value)}
                      minLength={3}
                      maxLength={32}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                      autoComplete="username"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleSaveUsername()}
                        disabled={isSavingUsername}
                        className="rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {isSavingUsername ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelUsernameEdit}
                        disabled={isSavingUsername}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="mt-1 flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                      {isLoadingProfile ? 'Loading...' : accountUsername}
                    </p>
                    <button
                      type="button"
                      onClick={handleStartUsernameEdit}
                      disabled={isLoadingProfile || isSavingUsername}
                      className="rounded-md border border-slate-300 p-1 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
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
                  <p className="mt-2 text-xs font-semibold text-rose-600">{usernameErrorMessage}</p>
                )}
                {usernameInfoMessage && (
                  <p className="mt-2 text-xs font-semibold text-emerald-600">{usernameInfoMessage}</p>
                )}
              </div>

              <div className="px-3 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</p>
                <p className="mt-1 min-w-0 truncate text-sm text-slate-800">{user.email ?? 'Not set'}</p>
              </div>

              {profileFriendCode && (
                <div className="px-3 pb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Friend Code</p>
                  <p className="mt-1 min-w-0 truncate text-sm text-slate-800">{profileFriendCode}</p>
                </div>
              )}

              <div className="my-1 border-t border-slate-200" />

              <button
                type="button"
                role="menuitem"
                disabled
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-500 disabled:cursor-not-allowed"
              >
                Change Password
              </button>

              <button
                type="button"
                role="menuitem"
                disabled
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-500 disabled:cursor-not-allowed"
              >
                Change Email
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default AccountMenu
