import { supabase } from '../supabaseClient'

type LyricsOverrideRow = {
  user_saved_album_id: string
  track_number: number
  lyrics: string
}

const throwIfError = (error: { message: string } | null, context: string) => {
  if (error) {
    throw new Error(`${context}: ${error.message}`)
  }
}

const requireAuthenticatedUserId = async () => {
  const { data, error } = await supabase.auth.getUser()
  throwIfError(error, 'Failed to resolve current user')

  const userId = data.user?.id
  if (!userId) {
    throw new Error('No authenticated user. Sign in first.')
  }

  return userId
}

// Returns lyrics overrides for every track in a given saved album, keyed by track number.
export const listLyricsOverridesForAlbum = async (
  userSavedAlbumId: string,
): Promise<Record<number, string>> => {
  await requireAuthenticatedUserId()

  const { data, error } = await supabase
    .from('user_lyrics_overrides')
    .select('track_number, lyrics')
    .eq('user_saved_album_id', userSavedAlbumId)

  throwIfError(error, 'Failed to load lyrics overrides')

  const result: Record<number, string> = {}
  for (const row of (data ?? []) as Pick<LyricsOverrideRow, 'track_number' | 'lyrics'>[]) {
    result[row.track_number] = row.lyrics
  }

  return result
}

// Returns all lyrics overrides for the current user across all albums.
// Keys are `${userSavedAlbumId}:${trackNumber}`.
export const listAllLyricsOverridesForCurrentUser = async (): Promise<Record<string, string>> => {
  const userId = await requireAuthenticatedUserId()

  const { data, error } = await supabase
    .from('user_lyrics_overrides')
    .select('user_saved_album_id, track_number, lyrics')
    .eq('user_id', userId)

  throwIfError(error, 'Failed to load all lyrics overrides')

  const result: Record<string, string> = {}
  for (const row of (data ?? []) as LyricsOverrideRow[]) {
    result[`${row.user_saved_album_id}:${row.track_number}`] = row.lyrics
  }

  return result
}

export const saveLyricsOverrideForCurrentUser = async (
  userSavedAlbumId: string,
  trackNumber: number,
  lyrics: string,
): Promise<void> => {
  const userId = await requireAuthenticatedUserId()

  const { error } = await (supabase.from('user_lyrics_overrides') as ReturnType<typeof supabase.from>).upsert(
    {
      user_id: userId,
      user_saved_album_id: userSavedAlbumId,
      track_number: trackNumber,
      lyrics,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,user_saved_album_id,track_number' },
  )

  throwIfError(error, 'Failed to save lyrics override')
}

export const deleteLyricsOverrideForCurrentUser = async (
  userSavedAlbumId: string,
  trackNumber: number,
): Promise<void> => {
  const userId = await requireAuthenticatedUserId()

  const { error } = await supabase
    .from('user_lyrics_overrides')
    .delete()
    .eq('user_id', userId)
    .eq('user_saved_album_id', userSavedAlbumId)
    .eq('track_number', trackNumber)

  throwIfError(error, 'Failed to delete lyrics override')
}
