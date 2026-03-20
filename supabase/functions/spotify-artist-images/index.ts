import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { getSpotifyClientCredentialsEnv } from '../_shared/env.ts'
import {
  errorResponse,
  handleCorsPreflight,
  jsonResponse,
  readJsonBody,
  requireMethod,
} from '../_shared/http.ts'
import { getSpotifyClientCredentialsToken, searchSpotifyArtistImage } from '../_shared/spotify.ts'

type RequestBody = {
  artistNames?: string[]
}

type ResponseBody = {
  images: Record<string, string | null>
}

serve(async (request) => {
  const preflight = handleCorsPreflight(request)
  if (preflight) {
    return preflight
  }

  try {
    requireMethod(request, ['POST'])

    const body = await readJsonBody<RequestBody>(request)
    const artistNames = Array.isArray(body?.artistNames) ? body.artistNames : []

    if (artistNames.length === 0) {
      return jsonResponse<ResponseBody>({ images: {} })
    }

    const { clientId, clientSecret } = getSpotifyClientCredentialsEnv()
    const accessToken = await getSpotifyClientCredentialsToken(clientId, clientSecret)

    const entries = await Promise.all(
      artistNames.map(async (name) => {
        const imageUrl = await searchSpotifyArtistImage({ accessToken, artistName: name }).catch(() => null)
        return [name, imageUrl] as const
      }),
    )

    return jsonResponse<ResponseBody>({ images: Object.fromEntries(entries) })
  } catch (error) {
    return errorResponse(error)
  }
})
