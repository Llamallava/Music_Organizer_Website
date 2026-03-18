import { createClient } from 'npm:@supabase/supabase-js@2'
import { getSupabaseEnv } from './env.ts'

let adminClient: ReturnType<typeof createClient> | null = null

export const getSupabaseAdminClient = () => {
  if (adminClient) {
    return adminClient
  }

  const { url, serviceRoleKey } = getSupabaseEnv()
  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return adminClient
}

