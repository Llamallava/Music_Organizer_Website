import { supabase } from '../supabaseClient'

export type FriendProfile = {
  userId: string
  username: string | null
  friendCode: string
}

export type FriendsOverview = {
  myFriendCode: string
  friends: FriendProfile[]
}

const FRIEND_CODE_PATTERN = /^[A-Z0-9]{10}$/

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

const normalizeFriendCode = (rawCode: string) => rawCode.trim().toUpperCase()

export const getFriendsOverviewForCurrentUser = async (): Promise<FriendsOverview> => {
  const userId = await requireAuthenticatedUserId()

  const [{ data: profileRow, error: profileError }, { data: friendshipRows, error: friendshipsError }] =
    await Promise.all([
      supabase.from('profiles').select('friend_code').eq('user_id', userId).maybeSingle(),
      supabase
        .from('friendships')
        .select('user_id, friend_user_id, created_at')
        .or(`user_id.eq.${userId},friend_user_id.eq.${userId}`)
        .order('created_at', { ascending: true }),
    ])

  throwIfError(profileError, 'Failed to load current profile')
  throwIfError(friendshipsError, 'Failed to load friends')

  const myFriendCode = profileRow?.friend_code
  if (!myFriendCode) {
    throw new Error('Your profile is missing a friend code.')
  }

  const friendUserIds = (friendshipRows ?? []).map((row) =>
    row.user_id === userId ? row.friend_user_id : row.user_id,
  )

  if (friendUserIds.length === 0) {
    return {
      myFriendCode,
      friends: [],
    }
  }

  const { data: friendProfiles, error: friendProfilesError } = await supabase
    .from('profiles')
    .select('user_id, username, friend_code')
    .in('user_id', friendUserIds)

  throwIfError(friendProfilesError, 'Failed to load friend profiles')

  const friendProfileById = new Map((friendProfiles ?? []).map((profile) => [profile.user_id, profile]))

  const friends = friendUserIds
    .flatMap((friendUserId) => {
      const profile = friendProfileById.get(friendUserId)
      if (!profile || !profile.friend_code) {
        return []
      }

      return {
        userId: profile.user_id,
        username: profile.username,
        friendCode: profile.friend_code,
      }
    })
    .sort((left, right) => {
      const leftName = left.username?.trim() || left.friendCode
      const rightName = right.username?.trim() || right.friendCode
      return leftName.localeCompare(rightName)
    })

  return {
    myFriendCode,
    friends,
  }
}

export const addFriendByCodeForCurrentUser = async (rawFriendCode: string): Promise<void> => {
  const userId = await requireAuthenticatedUserId()
  const friendCode = normalizeFriendCode(rawFriendCode)

  if (!FRIEND_CODE_PATTERN.test(friendCode)) {
    throw new Error('Friend code must be 10 letters/numbers.')
  }

  const { data: targetProfile, error: targetProfileError } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('friend_code', friendCode)
    .maybeSingle()

  throwIfError(targetProfileError, 'Failed to find user by friend code')

  if (!targetProfile) {
    throw new Error('No user found for that friend code.')
  }

  if (targetProfile.user_id === userId) {
    throw new Error('You cannot add yourself as a friend.')
  }

  const [firstUserId, secondUserId] =
    userId < targetProfile.user_id ? [userId, targetProfile.user_id] : [targetProfile.user_id, userId]

  const { error: upsertError } = await supabase.from('friendships').upsert(
    {
      user_id: firstUserId,
      friend_user_id: secondUserId,
    },
    {
      onConflict: 'user_id,friend_user_id',
      ignoreDuplicates: true,
    },
  )

  throwIfError(upsertError, 'Failed to add friend')
}
