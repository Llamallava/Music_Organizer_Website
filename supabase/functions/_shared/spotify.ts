import { HttpError } from './http.ts'

export type SpotifyTokenResponse = {
  access_token: string
  token_type: string
  scope: string
  expires_in: number
  refresh_token?: string
}

export type SpotifyProfile = {
  id: string
  display_name: string | null
  country?: string
  product?: string
}

export type SpotifyTrackSearchItem = {
  id: string
  uri: string
  name: string
  artists: Array<{ id: string; name: string }>
  album?: {
    id: string
    name: string
  }
}

export type SpotifyTrackSearchResponse = {
  tracks: {
    items: SpotifyTrackSearchItem[]
  }
}

export type SpotifyCreatedPlaylist = {
  id: string
  name: string
  external_urls?: {
    spotify?: string
  }
}

const ensureOk = async (response: Response, context: string) => {
  if (response.ok) {
    return
  }

  let details: unknown = null
  try {
    details = await response.json()
  } catch {
    details = await response.text().catch(() => null)
  }

  throw new HttpError(502, `${context} failed with status ${response.status}.`, 'spotify_api_error', details)
}

export const buildSpotifyAuthorizeUrl = (params: {
  clientId: string
  redirectUri: string
  state: string
  scope: string
  showDialog?: boolean
}) => {
  const url = new URL('https://accounts.spotify.com/authorize')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('state', params.state)
  url.searchParams.set('scope', params.scope)
  if (params.showDialog) {
    url.searchParams.set('show_dialog', 'true')
  }

  return url.toString()
}

const basicAuthHeader = (clientId: string, clientSecret: string) => {
  const encoded = btoa(`${clientId}:${clientSecret}`)
  return `Basic ${encoded}`
}

export const exchangeSpotifyCodeForTokens = async (params: {
  clientId: string
  clientSecret: string
  redirectUri: string
  code: string
}) => {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
  })

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(params.clientId, params.clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  await ensureOk(response, 'Spotify token exchange')
  return (await response.json()) as SpotifyTokenResponse
}

export const refreshSpotifyAccessToken = async (params: {
  clientId: string
  clientSecret: string
  refreshToken: string
}) => {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: params.refreshToken,
  })

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(params.clientId, params.clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  await ensureOk(response, 'Spotify access token refresh')
  return (await response.json()) as SpotifyTokenResponse
}

export const fetchSpotifyProfile = async (accessToken: string) => {
  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  await ensureOk(response, 'Spotify profile lookup')
  return (await response.json()) as SpotifyProfile
}

export const createSpotifyPlaylist = async (params: {
  accessToken: string
  spotifyUserId?: string
  name: string
  description?: string
  isPublic?: boolean
}) => {
  const response = await fetch(
    `https://api.spotify.com/v1/me/playlists`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: params.name,
        description: params.description ?? '',
        public: params.isPublic === true,
      }),
    },
  )

  await ensureOk(response, 'Spotify playlist creation')
  return (await response.json()) as SpotifyCreatedPlaylist
}

export const searchSpotifyTracks = async (params: {
  accessToken: string
  query: string
  limit?: number
}) => {
  const url = new URL('https://api.spotify.com/v1/search')
  url.searchParams.set('q', params.query)
  url.searchParams.set('type', 'track')
  url.searchParams.set('limit', String(params.limit ?? 5))

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
    },
  })

  await ensureOk(response, 'Spotify track search')
  return (await response.json()) as SpotifyTrackSearchResponse
}

export const getSpotifyClientCredentialsToken = async (clientId: string, clientSecret: string): Promise<string> => {
  const body = new URLSearchParams({ grant_type: 'client_credentials' })

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  await ensureOk(response, 'Spotify client credentials token')
  const data = (await response.json()) as { access_token: string }
  return data.access_token
}

type SpotifyArtistImage = {
  url: string
  height: number
  width: number
}

type SpotifyArtistSearchResponse = {
  artists: {
    items: Array<{
      id: string
      name: string
      images: SpotifyArtistImage[]
    }>
  }
}

export const searchSpotifyArtistImage = async (params: {
  accessToken: string
  artistName: string
}): Promise<string | null> => {
  const url = new URL('https://api.spotify.com/v1/search')
  url.searchParams.set('q', params.artistName)
  url.searchParams.set('type', 'artist')
  url.searchParams.set('limit', '1')

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${params.accessToken}` },
  })

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as SpotifyArtistSearchResponse
  const images = data.artists?.items?.[0]?.images

  if (!images?.length) {
    return null
  }

  // Prefer the image closest to 320px wide
  const sorted = [...images].sort((a, b) => a.width - b.width)
  const pick = sorted.find((img) => img.width >= 200) ?? sorted[sorted.length - 1]
  return pick?.url ?? null
}

type SpotifyAlbumSearchResponse = {
  albums: {
    items: Array<{
      id: string
      name: string
      artists: Array<{ name: string }>
      images: Array<{ url: string; height: number; width: number }>
    }>
  }
}

export const searchSpotifyAlbumCover = async (params: {
  accessToken: string
  artistName: string
  albumTitle: string
}): Promise<string | null> => {
  const url = new URL('https://api.spotify.com/v1/search')
  url.searchParams.set('q', `album:${params.albumTitle} artist:${params.artistName}`)
  url.searchParams.set('type', 'album')
  url.searchParams.set('limit', '1')

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${params.accessToken}` },
  })

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as SpotifyAlbumSearchResponse
  const images = data.albums?.items?.[0]?.images

  if (!images?.length) {
    return null
  }

  // Prefer image closest to 500px wide
  const sorted = [...images].sort((a, b) => a.width - b.width)
  const pick = sorted.find((img) => img.width >= 300) ?? sorted[sorted.length - 1]
  return pick?.url ?? null
}

export const addTracksToSpotifyPlaylist = async (params: {
  accessToken: string
  playlistId: string
  trackUris: string[]
}) => {
  if (params.trackUris.length === 0) {
    return
  }

  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(params.playlistId)}/tracks`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uris: params.trackUris,
      }),
    },
  )

  await ensureOk(response, 'Spotify playlist track add')
}
