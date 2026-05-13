import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

  const inputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    borderRadius: 6,
    border: '1px solid #2a2548',
    padding: '8px 12px',
    fontSize: 13,
    marginTop: 6,
  }

  return (
    <main style={{ display: 'flex', minHeight: 'calc(100vh - var(--nav-h))', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
      <div className="vco-panel" style={{ width: '100%', maxWidth: 420, padding: '28px 28px 24px' }}>
        <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 800, color: '#ede9fe', marginBottom: 4 }}>
          {mode === 'sign-in' ? 'Sign In' : 'Create Account'}
        </h1>
        <p style={{ fontSize: 12, color: '#7c6fad', fontFamily: "'JetBrains Mono', monospace", marginBottom: 20 }}>
          Use your email and password to continue.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'sign-up' && (
            <label style={{ fontSize: 12, fontWeight: 600, color: '#c4b5fd' }}>
              Username
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                minLength={3}
                maxLength={32}
                style={inputStyle}
              />
            </label>
          )}

          <label style={{ fontSize: 12, fontWeight: 600, color: '#c4b5fd' }}>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              style={inputStyle}
            />
          </label>

          <label style={{ fontSize: 12, fontWeight: 600, color: '#c4b5fd' }}>
            Password
            <input
              type="password"
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              style={inputStyle}
            />
          </label>

          {errorMessage && (
            <div className="vco-msg-err">{errorMessage}</div>
          )}

          {infoMessage && (
            <div className="vco-msg-ok">{infoMessage}</div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="vco-tbtn primary"
            style={{ width: '100%' }}
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
          style={{ marginTop: 16, fontSize: 12, color: '#7c6fad', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
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
