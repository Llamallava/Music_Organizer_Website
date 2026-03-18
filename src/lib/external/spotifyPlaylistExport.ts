import { supabase } from '../supabaseClient'

type SpotifyAuthStartResponse = {
  authorizeUrl: string
  stateExpiresAt: string
  scope: string[]
}

export type SpotifyExportPlaylistResponse = {
  playlist: {
    id: string
    name: string
  }
  destinationPlaylist: {
    id: string
    url: string | null
    name: string
    public: boolean
  }
  exportRun: {
    id: string
    status: 'succeeded' | 'partial' | 'failed'
  }
  summary: {
    totalSongs: number
    matchedSongs: number
    addedSongs: number
    unmatchedSongs: number
    skippedSongs: number
  }
  unmatchedSongs: Array<{
    playlistSongId: string
    trackTitle: string
    artistName: string
    albumTitle: string | null
    reason: string
  }>
}

const getEdgeFunctionBaseUrl = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables.')
  }

  let edgeFunctionsUrl: string
  try {
    edgeFunctionsUrl = new URL('/functions/v1/', supabaseUrl).toString()
  } catch {
    throw new Error('VITE_SUPABASE_URL is invalid.')
  }

  return {
    url: edgeFunctionsUrl.replace(/\/$/, ''),
    anonKey: supabaseAnonKey,
  }
}

const getCurrentAccessToken = async () => {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    throw new Error(`Failed to read session: ${error.message}`)
  }

  const accessToken = data.session?.access_token
  if (!accessToken) {
    throw new Error('No authenticated session found. Sign in again.')
  }

  return accessToken
}

const postEdgeFunctionJson = async <TResponse>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<TResponse> => {
  const [accessToken, base] = await Promise.all([getCurrentAccessToken(), Promise.resolve(getEdgeFunctionBaseUrl())])

  let response: Response
  try {
    response = await fetch(`${base.url}/${functionName}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: base.anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (error) {
    if (error instanceof TypeError && /fetch/i.test(error.message)) {
      throw new Error(
        'Unable to reach the Spotify connection service. Make sure Supabase Edge Functions are running/deployed and your VITE_SUPABASE_URL is correct.',
      )
    }

    throw error
  }

  const payload = (await response
    .clone()
    .json()
    .catch(async () => {
      const text = (await response.text().catch(() => '')).trim()
      return text ? { message: text } : null
    })) as { message?: string } | null

  if (!response.ok) {
    throw new Error(payload?.message || `${functionName} failed.`)
  }

  return payload as TResponse
}

export const startSpotifyConnectFlow = async () => {
  return postEdgeFunctionJson<SpotifyAuthStartResponse>('spotify-auth-start', {
    redirectPath: '/playlists',
  })
}

export const exportPlaylistToSpotify = async (playlistId: string, makePublic = false) => {
  return postEdgeFunctionJson<SpotifyExportPlaylistResponse>('spotify-export-playlist', {
    playlistId,
    makePublic,
  })
}
