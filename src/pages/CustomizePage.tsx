import { useEffect, useState } from 'react'
import LinearBackButton from '../components/LinearBackButton'
import {
  getAutoBackgroundEnabledForCurrentUser,
  setAutoBackgroundEnabledForCurrentUser,
} from '../lib/db/profileData'

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-slate-900' : 'bg-slate-300'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function CustomizePage() {
  const [autoBackground, setAutoBackground] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let isActive = true

    const load = async () => {
      try {
        const enabled = await getAutoBackgroundEnabledForCurrentUser()
        if (isActive) {
          setAutoBackground(enabled)
        }
      } catch {
        // Use default value — migration may not be applied yet
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      isActive = false
    }
  }, [])

  const handleAutoBackgroundChange = async (value: boolean) => {
    setAutoBackground(value)
    setIsSaving(true)

    try {
      await setAutoBackgroundEnabledForCurrentUser(value)
    } catch {
      setAutoBackground(!value)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <LinearBackButton />

        <h1 className="mt-6 text-3xl font-black text-slate-900">Customize</h1>

        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Backgrounds
          </h2>

          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Automatic background</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Cycle through album covers from your recent activity on the home page.
                </p>
              </div>
              <Toggle
                checked={autoBackground}
                onChange={(value) => void handleAutoBackgroundChange(value)}
                disabled={isLoading || isSaving}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default CustomizePage
