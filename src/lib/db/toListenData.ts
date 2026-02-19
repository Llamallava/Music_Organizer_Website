import { supabase } from '../supabaseClient'

export type ToListenSong = {
  id: string
  songName: string
  artistName: string
  createdAt: string
}

export type RecommendationType = 'song' | 'album'

export type ReceivedRecommendation = {
  id: string
  senderUserId: string
  senderUsername: string | null
  senderFriendCode: string | null
  recommendationType: RecommendationType
  songName: string
  artistName: string
  createdAt: string
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

export const listToListenSongsForCurrentUser = async (): Promise<ToListenSong[]> => {
  const userId = await requireAuthenticatedUserId()

  const { data, error } = await supabase
    .from('to_listen_songs')
    .select('id, song_name, artist_name, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  throwIfError(error, 'Failed to list to-listen songs')

  return (data ?? []).map((row) => ({
    id: row.id,
    songName: row.song_name,
    artistName: row.artist_name,
    createdAt: row.created_at,
  }))
}

export const addToListenSongForCurrentUser = async (params: {
  songName: string
  artistName: string
}): Promise<ToListenSong> => {
  const userId = await requireAuthenticatedUserId()
  const songName = params.songName.trim()
  const artistName = params.artistName.trim()

  if (!songName) {
    throw new Error('Song name is required.')
  }

  if (!artistName) {
    throw new Error('Artist name is required.')
  }

  const { data, error } = await supabase
    .from('to_listen_songs')
    .insert({
      user_id: userId,
      song_name: songName,
      artist_name: artistName,
    })
    .select('id, song_name, artist_name, created_at')
    .single()

  throwIfError(error, 'Failed to add to-listen song')
  if (!data) {
    throw new Error('To-listen insert succeeded but no row was returned.')
  }

  return {
    id: data.id,
    songName: data.song_name,
    artistName: data.artist_name,
    createdAt: data.created_at,
  }
}

export const removeToListenSongForCurrentUser = async (songId: string): Promise<void> => {
  const userId = await requireAuthenticatedUserId()

  const { error } = await supabase
    .from('to_listen_songs')
    .delete()
    .eq('id', songId)
    .eq('user_id', userId)

  throwIfError(error, 'Failed to remove to-listen song')
}

export const listReceivedRecommendationsForCurrentUser = async (): Promise<ReceivedRecommendation[]> => {
  const userId = await requireAuthenticatedUserId()

  const { data, error } = await supabase
    .from('song_recommendations')
    .select('id, sender_user_id, recommendation_type, song_name, artist_name, created_at')
    .eq('receiver_user_id', userId)
    .order('created_at', { ascending: false })

  throwIfError(error, 'Failed to list received recommendations')

  const recommendationRows = data ?? []
  const senderIds = Array.from(new Set(recommendationRows.map((row) => row.sender_user_id)))

  const senderProfileByUserId = new Map<string, { username: string | null; friendCode: string | null }>()
  if (senderIds.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, username, friend_code')
      .in('user_id', senderIds)

    throwIfError(profileError, 'Failed to load recommendation sender profiles')

    for (const row of profileRows ?? []) {
      senderProfileByUserId.set(row.user_id, {
        username: row.username,
        friendCode: row.friend_code,
      })
    }
  }

  return recommendationRows.map((row) => {
    const senderProfile = senderProfileByUserId.get(row.sender_user_id)
    return {
      id: row.id,
      senderUserId: row.sender_user_id,
      senderUsername: senderProfile?.username ?? null,
      senderFriendCode: senderProfile?.friendCode ?? null,
      recommendationType: row.recommendation_type,
      songName: row.song_name,
      artistName: row.artist_name,
      createdAt: row.created_at,
    }
  })
}

export const sendRecommendationForCurrentUser = async (params: {
  friendUserId: string
  recommendationType?: RecommendationType
  songName: string
  artistName: string
}): Promise<void> => {
  const userId = await requireAuthenticatedUserId()
  const friendUserId = params.friendUserId.trim()
  const recommendationType = params.recommendationType ?? 'song'
  const songName = params.songName.trim()
  const artistName = params.artistName.trim()

  if (!friendUserId) {
    throw new Error('Please choose a friend first.')
  }

  if (friendUserId === userId) {
    throw new Error('You cannot send a recommendation to yourself.')
  }

  if (!songName) {
    throw new Error('Song name is required.')
  }

  if (!artistName) {
    throw new Error('Artist name is required.')
  }

  const { error } = await supabase.from('song_recommendations').insert({
    sender_user_id: userId,
    receiver_user_id: friendUserId,
    recommendation_type: recommendationType,
    song_name: songName,
    artist_name: artistName,
  })

  throwIfError(error, 'Failed to send recommendation')
}

export const removeReceivedRecommendationForCurrentUser = async (recommendationId: string): Promise<void> => {
  const userId = await requireAuthenticatedUserId()

  const { error } = await supabase
    .from('song_recommendations')
    .delete()
    .eq('id', recommendationId)
    .eq('receiver_user_id', userId)

  throwIfError(error, 'Failed to remove recommendation')
}
