import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuthSession } from '../hooks/useAuthSession'
import {
  getAutoBackgroundEnabledForCurrentUser,
  getHomeBackgroundForCurrentUser,
  listCoversForHomeBackground,
} from '../lib/db/profileData'

const CYCLE_INTERVAL_MS = 30_000

type BackgroundContextValue = {
  layers: [string, string]
  activeLayer: 0 | 1 | null
}

const BackgroundContext = createContext<BackgroundContextValue>({
  layers: ['', ''],
  activeLayer: null,
})

export const useBackground = () => useContext(BackgroundContext)

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuthSession()
  const [layers, setLayers] = useState<[string, string]>(['', ''])
  const [activeLayer, setActiveLayer] = useState<0 | 1 | null>(null)
  const [covers, setCovers] = useState<string[]>([])
  const coverIndexRef = useRef(0)
  const activeLayerRef = useRef<0 | 1>(0)

  // Reset when user logs out
  useEffect(() => {
    if (!user) {
      setLayers(['', ''])
      setActiveLayer(null)
      setCovers([])
      coverIndexRef.current = 0
      activeLayerRef.current = 0
    }
  }, [user])

  // Load covers once when the user is known
  useEffect(() => {
    if (isAuthLoading || !user) return

    let isActive = true

    const load = async () => {
      try {
        const [pinnedUrl, dynamicCovers, autoEnabled] = await Promise.all([
          getHomeBackgroundForCurrentUser(),
          listCoversForHomeBackground(),
          getAutoBackgroundEnabledForCurrentUser().catch(() => true),
        ])

        if (!isActive) return

        if (pinnedUrl) {
          setLayers([pinnedUrl, ''])
          requestAnimationFrame(() => {
            if (isActive) setActiveLayer(0)
          })
        } else if (autoEnabled && dynamicCovers.length > 0) {
          setLayers([dynamicCovers[0], ''])
          requestAnimationFrame(() => {
            if (isActive) setActiveLayer(0)
          })
          setCovers(dynamicCovers)
        }
      } catch {
        // Stay plain
      }
    }

    void load()

    return () => {
      isActive = false
    }
  }, [user, isAuthLoading])

  // Cycle covers
  useEffect(() => {
    if (covers.length <= 1) return

    const interval = setInterval(() => {
      coverIndexRef.current = (coverIndexRef.current + 1) % covers.length
      const nextUrl = covers[coverIndexRef.current]
      const nextLayer: 0 | 1 = activeLayerRef.current === 0 ? 1 : 0

      setLayers((prev) => {
        const updated: [string, string] = [prev[0], prev[1]]
        updated[nextLayer] = nextUrl
        return updated
      })

      setTimeout(() => {
        activeLayerRef.current = nextLayer
        setActiveLayer(nextLayer)
      }, 50)
    }, CYCLE_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [covers])

  return (
    <BackgroundContext.Provider value={{ layers, activeLayer }}>
      {children}
    </BackgroundContext.Provider>
  )
}
