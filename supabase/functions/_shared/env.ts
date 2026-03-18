import { HttpError } from './http.ts'

const requireEnv = (name: string) => {
  const value = Deno.env.get(name)?.trim()
  if (!value) {
    throw new HttpError(500, `Missing required environment variable: ${name}`, 'missing_env')
  }

  return value
}

export const spotifyScopes = ['playlist-modify-private', 'playlist-modify-public'] as const

export const getSupabaseEnv = () => ({
  url: requireEnv('SUPABASE_URL'),
  serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
})

export const getSpotifyEnv = () => ({
  clientId: requireEnv('SPOTIFY_CLIENT_ID'),
  clientSecret: requireEnv('SPOTIFY_CLIENT_SECRET'),
  redirectUri: requireEnv('SPOTIFY_REDIRECT_URI'),
})

export const getAppOrigin = () => requireEnv('APP_ORIGIN')

