import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { getAppOrigin, getSpotifyEnv } from '../_shared/env.ts'
import { errorResponse, handleCorsPreflight, HttpError, redirectResponse, requireMethod } from '../_shared/http.ts'
import { exchangeSpotifyCodeForTokens, fetchSpotifyProfile } from '../_shared/spotify.ts'
import { getSupabaseAdminClient } from '../_shared/supabaseAdmin.ts'

const defaultRedirectPath = '/playlists'

const isExpired = (isoTimestamp: string) => new Date(isoTimestamp).getTime() < Date.now()

const normalizeRedirectPath = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return defaultRedirectPath
  }

  return trimmed
}

const buildAppRedirectUrl = (redirectPath: string, params: Record<string, string>) => {
  const url = new URL(normalizeRedirectPath(redirectPath), getAppOrigin())
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

const redirectWithStatus = (redirectPath: string, params: Record<string, string>) =>
  redirectResponse(buildAppRedirectUrl(redirectPath, params))

serve(async (request) => {
  const preflight = handleCorsPreflight(request)
  if (preflight) {
    return preflight
  }

  try {
    requireMethod(request, ['GET'])

    const url = new URL(request.url)
    const code = url.searchParams.get('code')?.trim()
    const state = url.searchParams.get('state')?.trim()
    const spotifyError = url.searchParams.get('error')?.trim()

    if (!state) {
      return redirectWithStatus(defaultRedirectPath, {
        spotifyConnect: 'error',
        message: 'Missing OAuth state.',
      })
    }

    const supabase = getSupabaseAdminClient()
    const { data: stateRow, error: stateLookupError } = await supabase
      .from('spotify_oauth_states')
      .select('id, user_id, state, requested_scopes, redirect_path, expires_at, consumed_at')
      .eq('state', state)
      .maybeSingle()

    if (stateLookupError) {
      throw new HttpError(500, 'Failed to load OAuth state.', 'oauth_state_lookup_failed', stateLookupError)
    }

    if (!stateRow) {
      return redirectWithStatus(defaultRedirectPath, {
        spotifyConnect: 'error',
        message: 'Invalid OAuth state.',
      })
    }

    const redirectPath = normalizeRedirectPath(stateRow.redirect_path)

    if (stateRow.consumed_at) {
      return redirectWithStatus(redirectPath, {
        spotifyConnect: 'error',
        message: 'OAuth state has already been used.',
      })
    }

    if (isExpired(stateRow.expires_at)) {
      await supabase.from('spotify_oauth_states').update({ consumed_at: new Date().toISOString() }).eq('id', stateRow.id)
      return redirectWithStatus(redirectPath, {
        spotifyConnect: 'error',
        message: 'OAuth state expired. Please try again.',
      })
    }

    if (spotifyError) {
      await supabase.from('spotify_oauth_states').update({ consumed_at: new Date().toISOString() }).eq('id', stateRow.id)
      return redirectWithStatus(redirectPath, {
        spotifyConnect: 'error',
        message: `Spotify returned error: ${spotifyError}`,
      })
    }

    if (!code) {
      await supabase.from('spotify_oauth_states').update({ consumed_at: new Date().toISOString() }).eq('id', stateRow.id)
      return redirectWithStatus(redirectPath, {
        spotifyConnect: 'error',
        message: 'Missing authorization code.',
      })
    }

    const spotifyEnv = getSpotifyEnv()
    const tokenResponse = await exchangeSpotifyCodeForTokens({
      clientId: spotifyEnv.clientId,
      clientSecret: spotifyEnv.clientSecret,
      redirectUri: spotifyEnv.redirectUri,
      code,
    })

    const profile = await fetchSpotifyProfile(tokenResponse.access_token)

    const { data: existingConnection, error: existingConnectionError } = await supabase
      .from('spotify_connections')
      .select('refresh_token')
      .eq('user_id', stateRow.user_id)
      .maybeSingle()

    if (existingConnectionError) {
      throw new HttpError(
        500,
        'Failed to load existing Spotify connection.',
        'spotify_connection_lookup_failed',
        existingConnectionError,
      )
    }

    const refreshToken = tokenResponse.refresh_token ?? existingConnection?.refresh_token ?? null
    if (!refreshToken) {
      throw new HttpError(502, 'Spotify did not return a refresh token.', 'missing_spotify_refresh_token')
    }

    const { error: upsertError } = await supabase.from('spotify_connections').upsert(
      {
        user_id: stateRow.user_id,
        spotify_user_id: profile.id,
        spotify_display_name: profile.display_name ?? null,
        spotify_country: profile.country ?? null,
        spotify_product: profile.product ?? null,
        scope: tokenResponse.scope ?? stateRow.requested_scopes,
        refresh_token: refreshToken,
        profile_snapshot: profile,
        last_connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

    if (upsertError) {
      throw new HttpError(500, 'Failed to save Spotify connection.', 'spotify_connection_upsert_failed', upsertError)
    }

    const { error: consumeError } = await supabase
      .from('spotify_oauth_states')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', stateRow.id)

    if (consumeError) {
      throw new HttpError(500, 'Failed to finalize OAuth state.', 'oauth_state_consume_failed', consumeError)
    }

    return redirectWithStatus(redirectPath, {
      spotifyConnect: 'success',
    })
  } catch (error) {
    if (error instanceof HttpError) {
      return errorResponse(error)
    }

    return errorResponse(error)
  }
})

