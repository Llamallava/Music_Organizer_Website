import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { requireSupabaseUser } from '../_shared/auth.ts'
import { getSpotifyEnv, spotifyScopes } from '../_shared/env.ts'
import { buildSpotifyAuthorizeUrl } from '../_shared/spotify.ts'
import {
  errorResponse,
  handleCorsPreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  requireMethod,
} from '../_shared/http.ts'
import { getSupabaseAdminClient } from '../_shared/supabaseAdmin.ts'

type StartRequestBody = {
  redirectPath?: string | null
  showDialog?: boolean
}

const normalizeRedirectPath = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  if (!trimmed) {
    return '/playlists'
  }

  if (!trimmed.startsWith('/')) {
    throw new HttpError(400, 'redirectPath must be a relative path starting with "/".', 'invalid_redirect_path')
  }

  if (trimmed.startsWith('//')) {
    throw new HttpError(400, 'redirectPath cannot be protocol-relative.', 'invalid_redirect_path')
  }

  return trimmed
}

serve(async (request) => {
  const preflight = handleCorsPreflight(request)
  if (preflight) {
    return preflight
  }

  try {
    requireMethod(request, ['POST'])

    const { user } = await requireSupabaseUser(request)
    const body = (await readJsonBody<StartRequestBody>(request)) ?? {}

    const state = `${crypto.randomUUID()}-${crypto.randomUUID()}`
    const redirectPath = normalizeRedirectPath(body.redirectPath)
    const scope = spotifyScopes.join(' ')
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    const supabase = getSupabaseAdminClient()

    const { error } = await supabase.from('spotify_oauth_states').insert({
      user_id: user.id,
      state,
      requested_scopes: scope,
      redirect_path: redirectPath,
      expires_at: expiresAt,
    })

    if (error) {
      throw new HttpError(500, 'Failed to create Spotify OAuth state.', 'oauth_state_insert_failed', error)
    }

    const spotifyEnv = getSpotifyEnv()
    const authorizeUrl = buildSpotifyAuthorizeUrl({
      clientId: spotifyEnv.clientId,
      redirectUri: spotifyEnv.redirectUri,
      state,
      scope,
      showDialog: body.showDialog === true,
    })

    return jsonResponse({
      authorizeUrl,
      stateExpiresAt: expiresAt,
      scope: spotifyScopes,
    })
  } catch (error) {
    return errorResponse(error)
  }
})

