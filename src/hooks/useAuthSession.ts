import type { Session, User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type UseAuthSessionResult = {
  session: Session | null
  user: User | null
  isLoading: boolean
}

export const useAuthSession = (): UseAuthSessionResult => {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isActive = true

    const loadInitialSession = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (!isActive) {
        return
      }

      if (error) {
        setSession(null)
        setIsLoading(false)
        return
      }

      setSession(data.session)
      setIsLoading(false)
    }

    void loadInitialSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isActive) {
        return
      }

      setSession(nextSession)
      setIsLoading(false)
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [])

  return {
    session,
    user: session?.user ?? null,
    isLoading,
  }
}
