import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { getSpotifyClientCredentialsEnv } from '../_shared/env.ts'
import {
  errorResponse,
  handleCorsPreflight,
  jsonResponse,
  readJsonBody,
  requireMethod,
} from '../_shared/http.ts'
import { getSpotifyClientCredentialsToken, searchSpotifyAlbumCover } from '../_shared/spotify.ts'

type AlbumInput = {
  artistName: string
  albumTitle: string
}

type RequestBody = {
  albums?: AlbumInput[]
}

type ResponseBody = {
  covers: (string | null)[]
}

serve(async (request) => {
  const preflight = handleCorsPreflight(request)
  if (preflight) {
    return preflight
  }

  try {
    requireMethod(request, ['POST'])

    const body = await readJsonBody<RequestBody>(request)
    const albums = Array.isArray(body?.albums) ? body.albums : []

    if (albums.length === 0) {
      return jsonResponse<ResponseBody>({ covers: [] })
    }

    const { clientId, clientSecret } = getSpotifyClientCredentialsEnv()
    const accessToken = await getSpotifyClientCredentialsToken(clientId, clientSecret)

    const covers = await Promise.all(
      albums.map(({ artistName, albumTitle }) =>
        searchSpotifyAlbumCover({ accessToken, artistName, albumTitle }).catch(() => null),
      ),
    )

    return jsonResponse<ResponseBody>({ covers })
  } catch (error) {
    return errorResponse(error)
  }
})
