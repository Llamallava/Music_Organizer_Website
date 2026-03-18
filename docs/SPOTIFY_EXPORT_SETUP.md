# Spotify Export Setup (Foundation)

This project now includes Supabase Edge Function scaffolding for Spotify OAuth and playlist export:

- `spotify-auth-start`
- `spotify-auth-callback`
- `spotify-export-playlist` (MVP export: create Spotify playlist + match/search + add tracks)

## 1. Create a Spotify App

In the Spotify Developer Dashboard, create an app and configure redirect URIs.

Use the Supabase Edge Function callback URL as the redirect URI:

- Local Supabase CLI (typical): `http://127.0.0.1:54321/functions/v1/spotify-auth-callback`
- Hosted Supabase: `https://<your-project-ref>.supabase.co/functions/v1/spotify-auth-callback`

Required scopes for the current scaffold:

- `playlist-modify-private`
- `playlist-modify-public`

## 2. Apply the Migration

Apply the new migration that adds:

- `spotify_connections` (private refresh-token storage)
- `spotify_oauth_states` (OAuth state tracking)
- `playlist_export_runs` (export history/logging)

Migration file:

- `supabase/migrations/20260225120000_add_spotify_export_foundation.sql`

## 3. Set Supabase Edge Function Secrets

Set these secrets for Edge Functions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI` (must exactly match Spotify app redirect URI)
- `APP_ORIGIN` (your frontend base URL, e.g. `http://localhost:5173`)

## 4. Deploy Functions

Deploy the new functions:

- `spotify-auth-start`
- `spotify-auth-callback`
- `spotify-export-playlist`

## 5. Frontend Integration (Next Step)

From the React app:

1. Call `spotify-auth-start` (authenticated) to get `authorizeUrl`
2. Redirect browser to `authorizeUrl`
3. Handle callback return on `/playlists` using query params:
   - `spotifyConnect=success`
   - `spotifyConnect=error&message=...`
4. Call `spotify-export-playlist` (authenticated) with `{ playlistId, makePublic }`
5. Read the response summary and show unmatched tracks to the user

## Current Limitations (MVP)

- Track matching is search-based (`title + artist`, with album as a signal) and can miss songs or choose no match for low-confidence results.
- No persisted Spotify track IDs are stored yet, so repeat exports re-run matching.
- Large playlists may be slower because matching currently performs per-song Spotify searches.
