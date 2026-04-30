import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LinearBackButton from '../components/LinearBackButton'
import { useAuthSession } from '../hooks/useAuthSession'
import { supabase } from '../lib/supabaseClient'

type AuthMode = 'sign-in' | 'sign-up'

function AuthPage() {
  const navigate = useNavigate()
  const { user, isLoading } = useAuthSession()
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && user) {
      navigate('/reviews', { replace: true })
    }
  }, [isLoading, navigate, user])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setInfoMessage(null)
    setIsSubmitting(true)

    try {
      if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (error) {
          throw error
        }

        navigate('/reviews', { replace: true })
      } else {
        const trimmedUsername = username.trim()
        if (trimmedUsername.length < 3 || trimmedUsername.length > 32) {
          throw new Error('Username must be between 3 and 32 characters.')
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              username: trimmedUsername,
            },
          },
        })

        if (error) {
          throw error
        }

        if (data.session) {
          navigate('/reviews', { replace: true })
          return
        }

        setInfoMessage('Account created. Please sign in now.')
        setMode('sign-in')
        setUsername('')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed.'
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-xl border border-edge bg-surface p-6">
        <LinearBackButton className="mb-4" />

        <h1 className="text-2xl font-bold text-ink">
          {mode === 'sign-in' ? 'Sign In' : 'Create Account'}
        </h1>
        <p className="mt-2 text-sm text-ink">Use your email and password to continue.</p>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
          {mode === 'sign-up' && (
            <label className="text-sm font-semibold text-ink">
              Username
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                minLength={3}
                maxLength={32}
                className="mt-1 w-full rounded-lg border border-edge px-3 py-2 text-sm"
              />
            </label>
          )}

          <label className="text-sm font-semibold text-ink">
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-edge px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm font-semibold text-ink">
            Password
            <input
              type="password"
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              className="mt-1 w-full rounded-lg border border-edge px-3 py-2 text-sm"
            />
          </label>

          {errorMessage && (
            <div className="rounded-lg border border-err-edge bg-err-bg p-3 text-sm text-err">
              {errorMessage}
            </div>
          )}

          {infoMessage && (
            <div className="rounded-lg border border-ok-edge bg-ok-bg p-3 text-sm text-ok">
              {infoMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting
              ? 'Please wait...'
              : mode === 'sign-in'
                ? 'Sign In'
                : 'Create Account'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode((previous) => (previous === 'sign-in' ? 'sign-up' : 'sign-in'))
            setErrorMessage(null)
            setInfoMessage(null)
            if (mode === 'sign-up') {
              setUsername('')
            }
          }}
          className="mt-4 text-sm font-semibold text-ink-2 underline"
        >
          {mode === 'sign-in'
            ? "Don't have an account? Create one"
            : 'Already have an account? Sign in'}
        </button>
      </div>
    </main>
  )
}

export default AuthPage
