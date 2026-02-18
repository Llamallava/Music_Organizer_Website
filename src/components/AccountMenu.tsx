import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthSession } from '../hooks/useAuthSession'
import { supabase } from '../lib/supabaseClient'

function AccountMenu() {
  const { user, isLoading } = useAuthSession()
  const navigate = useNavigate()
  const location = useLocation()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    setIsOpen(false)
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
      setIsLoggingOut(false)
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
          className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => setIsOpen(false)}
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
        </div>
      )}
    </div>
  )
}

export default AccountMenu
