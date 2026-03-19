import { supabase } from '../supabaseClient'

type SongTagRow = {
  user_saved_album_id: string
  track_number: number
  tag: string
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

const normalizeTag = (tag: string) => tag.trim().toLowerCase()

// Returns tags for every track in a given saved album, keyed by track number.
export const listTagsForAlbum = async (
  userSavedAlbumId: string,
): Promise<Record<number, string[]>> => {
  await requireAuthenticatedUserId()

  const { data, error } = await supabase
    .from('song_tags')
    .select('track_number, tag')
    .eq('user_saved_album_id', userSavedAlbumId)
    .order('created_at', { ascending: true })

  throwIfError(error, 'Failed to load tags for album')

  const result: Record<number, string[]> = {}
  for (const row of (data ?? []) as Pick<SongTagRow, 'track_number' | 'tag'>[]) {
    result[row.track_number] ??= []
    result[row.track_number].push(row.tag)
  }

  return result
}

// Returns all tags for the current user across all albums.
// Keys are `${userSavedAlbumId}:${trackNumber}`.
export const listAllTagsForCurrentUser = async (): Promise<Record<string, string[]>> => {
  const userId = await requireAuthenticatedUserId()

  const { data, error } = await supabase
    .from('song_tags')
    .select('user_saved_album_id, track_number, tag')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  throwIfError(error, 'Failed to load all tags')

  const result: Record<string, string[]> = {}
  for (const row of (data ?? []) as SongTagRow[]) {
    const key = `${row.user_saved_album_id}:${row.track_number}`
    result[key] ??= []
    result[key].push(row.tag)
  }

  return result
}

export const addTagForCurrentUser = async (
  userSavedAlbumId: string,
  trackNumber: number,
  rawTag: string,
): Promise<void> => {
  const userId = await requireAuthenticatedUserId()

  const tag = normalizeTag(rawTag)
  if (!tag) {
    throw new Error('Tag cannot be empty.')
  }
  if (tag.length > 50) {
    throw new Error('Tag must be 50 characters or fewer.')
  }

  const { error } = await (supabase.from('song_tags') as ReturnType<typeof supabase.from>).insert({
    user_id: userId,
    user_saved_album_id: userSavedAlbumId,
    track_number: trackNumber,
    tag,
  })

  throwIfError(error, 'Failed to add tag')
}

export const removeTagForCurrentUser = async (
  userSavedAlbumId: string,
  trackNumber: number,
  rawTag: string,
): Promise<void> => {
  const userId = await requireAuthenticatedUserId()
  const tag = normalizeTag(rawTag)

  const { error } = await supabase
    .from('song_tags')
    .delete()
    .eq('user_id', userId)
    .eq('user_saved_album_id', userSavedAlbumId)
    .eq('track_number', trackNumber)
    .eq('tag', tag)

  throwIfError(error, 'Failed to remove tag')
}
