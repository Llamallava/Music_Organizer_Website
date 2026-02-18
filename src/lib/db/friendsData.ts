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
const FRIEND_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const FRIEND_CODE_LENGTH = 10
const MAX_FRIEND_CODE_ASSIGNMENT_ATTEMPTS = 5

const throwIfError = (error: { message: string; code?: string } | null, context: string) => {
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

const generateFriendCodeCandidate = () => {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.getRandomValues) {
    const randomValues = new Uint8Array(FRIEND_CODE_LENGTH)
    cryptoApi.getRandomValues(randomValues)
    return Array.from(randomValues, (value) => FRIEND_CODE_ALPHABET[value % FRIEND_CODE_ALPHABET.length]).join('')
  }

  return Array.from(
    { length: FRIEND_CODE_LENGTH },
    () => FRIEND_CODE_ALPHABET[Math.floor(Math.random() * FRIEND_CODE_ALPHABET.length)],
  ).join('')
}

const loadCurrentUserFriendCode = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('friend_code')
    .eq('user_id', userId)
    .maybeSingle()

  throwIfError(error, 'Failed to load current profile')
  return data?.friend_code ?? null
}

const ensureCurrentUserFriendCode = async (userId: string): Promise<string> => {
  const existingFriendCode = await loadCurrentUserFriendCode(userId)
  if (existingFriendCode) {
    return existingFriendCode
  }

  const { error: insertError } = await supabase.from('profiles').upsert(
    {
      user_id: userId,
    },
    {
      onConflict: 'user_id',
      ignoreDuplicates: true,
    },
  )

  throwIfError(insertError, 'Failed to create missing profile')

  const friendCodeAfterInsert = await loadCurrentUserFriendCode(userId)
  if (friendCodeAfterInsert) {
    return friendCodeAfterInsert
  }

  for (let attempt = 0; attempt < MAX_FRIEND_CODE_ASSIGNMENT_ATTEMPTS; attempt += 1) {
    const candidateFriendCode = generateFriendCodeCandidate()
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        friend_code: candidateFriendCode,
      })
      .eq('user_id', userId)
      .is('friend_code', null)

    if (updateError?.code === '23505') {
      continue
    }

    throwIfError(updateError, 'Failed to assign friend code')

    const assignedFriendCode = await loadCurrentUserFriendCode(userId)
    if (assignedFriendCode) {
      return assignedFriendCode
    }
  }

  throw new Error('Unable to assign a friend code right now. Please try again.')
}

export const getFriendsOverviewForCurrentUser = async (): Promise<FriendsOverview> => {
  const userId = await requireAuthenticatedUserId()

  const [
    myFriendCode,
    { data: friendshipRows, error: friendshipsError },
  ] =
    await Promise.all([
      ensureCurrentUserFriendCode(userId),
      supabase
        .from('friendships')
        .select('user_id, friend_user_id, created_at')
        .or(`user_id.eq.${userId},friend_user_id.eq.${userId}`)
        .order('created_at', { ascending: true }),
    ])

  throwIfError(friendshipsError, 'Failed to load friends')

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

const resolveFriendTargetByCodeForCurrentUser = async (rawFriendCode: string): Promise<{
  currentUserId: string
  targetProfile: FriendProfile
}> => {
  const currentUserId = await requireAuthenticatedUserId()
  const friendCode = normalizeFriendCode(rawFriendCode)

  if (!FRIEND_CODE_PATTERN.test(friendCode)) {
    throw new Error('Friend code must be 10 letters/numbers.')
  }

  const { data: targetProfile, error: targetProfileError } = await supabase
    .from('profiles')
    .select('user_id, username, friend_code')
    .eq('friend_code', friendCode)
    .maybeSingle()

  throwIfError(targetProfileError, 'Failed to find user by friend code')

  if (!targetProfile || !targetProfile.friend_code) {
    throw new Error('No user found for that friend code.')
  }

  if (targetProfile.user_id === currentUserId) {
    throw new Error('You cannot add yourself as a friend.')
  }

  return {
    currentUserId,
    targetProfile: {
      userId: targetProfile.user_id,
      username: targetProfile.username,
      friendCode: targetProfile.friend_code,
    },
  }
}

export const lookupFriendByCodeForCurrentUser = async (rawFriendCode: string): Promise<FriendProfile> => {
  const { targetProfile } = await resolveFriendTargetByCodeForCurrentUser(rawFriendCode)
  return targetProfile
}

export const addFriendByCodeForCurrentUser = async (rawFriendCode: string): Promise<void> => {
  const { currentUserId, targetProfile } = await resolveFriendTargetByCodeForCurrentUser(rawFriendCode)

  const [firstUserId, secondUserId] =
    currentUserId < targetProfile.userId
      ? [currentUserId, targetProfile.userId]
      : [targetProfile.userId, currentUserId]

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

export const removeFriendForCurrentUser = async (friendUserId: string): Promise<void> => {
  const currentUserId = await requireAuthenticatedUserId()

  if (!friendUserId) {
    throw new Error('Missing friend identifier.')
  }

  if (friendUserId === currentUserId) {
    throw new Error('You cannot remove yourself.')
  }

  const [firstUserId, secondUserId] =
    currentUserId < friendUserId ? [currentUserId, friendUserId] : [friendUserId, currentUserId]

  const { error: deleteError } = await supabase
    .from('friendships')
    .delete()
    .eq('user_id', firstUserId)
    .eq('friend_user_id', secondUserId)

  throwIfError(deleteError, 'Failed to remove friend')
}
