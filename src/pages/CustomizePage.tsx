import { useEffect, useState } from 'react'
import {
  getAutoBackgroundEnabledForCurrentUser,
  getBackgroundAllCoversEnabledForCurrentUser,
  setAutoBackgroundEnabledForCurrentUser,
  setBackgroundAllCoversEnabledForCurrentUser,
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
        checked ? 'bg-cta' : 'bg-surface-3'
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
  const [allCovers, setAllCovers] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingAllCovers, setIsSavingAllCovers] = useState(false)

  useEffect(() => {
    let isActive = true

    const load = async () => {
      try {
        const [autoEnabled, allCoversEnabled] = await Promise.all([
          getAutoBackgroundEnabledForCurrentUser(),
          getBackgroundAllCoversEnabledForCurrentUser().catch(() => false),
        ])
        if (isActive) {
          setAutoBackground(autoEnabled)
          setAllCovers(allCoversEnabled)
        }
      } catch {
        // Use default values — migration may not be applied yet
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

  const handleAllCoversChange = async (value: boolean) => {
    setAllCovers(value)
    setIsSavingAllCovers(true)

    try {
      await setBackgroundAllCoversEnabledForCurrentUser(value)
    } catch {
      setAllCovers(!value)
    } finally {
      setIsSavingAllCovers(false)
    }
  }

  return (
    <main className="page-wrap">
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 className="page-title">Customize</h1>

        <section style={{ marginTop: 28 }}>
          <p className="vco-label">Backgrounds</p>

          <div className="vco-panel" style={{ marginTop: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#ede9fe' }}>Automatic background</p>
                <p style={{ marginTop: 2, fontSize: 12, color: '#7c6fad' }}>
                  Cycle through album covers from your recent activity on the home page.
                </p>
              </div>
              <Toggle
                checked={autoBackground}
                onChange={(value) => void handleAutoBackgroundChange(value)}
                disabled={isLoading || isSaving}
              />
            </div>

            <div style={{ borderTop: '1px solid #2a2548', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#ede9fe' }}>Use all albums</p>
                <p style={{ marginTop: 2, fontSize: 12, color: '#7c6fad' }}>
                  Rotate through all albums randomly
                </p>
              </div>
              <Toggle
                checked={allCovers}
                onChange={(value) => void handleAllCoversChange(value)}
                disabled={isLoading || isSavingAllCovers || !autoBackground}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default CustomizePage
