import { supabase } from '../supabaseClient'
import type { Json } from './database.types'

export type ExploreNotification =
  | {
      id: string
      type: 'recommendation_received'
      createdAt: string
      songName: string
      artistName: string
      friendDisplayName: string
      isOld: boolean
    }
  | {
      id: string
      type: 'recommendation_listened'
      createdAt: string
      songName: string
      artistName: string
      friendDisplayName: string
    }
  | {
      id: 'to_listen_backlog'
      type: 'to_listen_backlog'
      createdAt: string
      count: number
    }

type NotificationEventType = 'recommendation_received' | 'recommendation_listened'

type NotificationEventRow = {
  id: string
  event_type: NotificationEventType
  payload: Json
  created_at: string
}

const REQUEST_OLD_AFTER_DAYS = 3

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

const getPayloadObject = (payload: Json): Record<string, Json> => {
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
    return {}
  }

  return payload as Record<string, Json>
}

const getPayloadString = (payload: Record<string, Json>, key: string): string | null => {
  const value = payload[key]
  return typeof value === 'string' ? value : null
}

const buildFriendDisplayName = (username: string | null, friendCode: string | null, userId: string) => {
  const trimmedName = username?.trim()
  if (trimmedName) {
    return trimmedName
  }

  if (friendCode) {
    return friendCode
  }

  return userId
}

const isOlderThanDays = (isoTimestamp: string, days: number): boolean => {
  const parsed = new Date(isoTimestamp)
  if (Number.isNaN(parsed.getTime())) {
    return false
  }

  const maxAgeMs = days * 24 * 60 * 60 * 1000
  return Date.now() - parsed.getTime() > maxAgeMs
}

export const listExploreNotificationsForCurrentUser = async (): Promise<ExploreNotification[]> => {
  const userId = await requireAuthenticatedUserId()

  const [
    { data: notificationRows, error: notificationsError },
    { count: toListenCount, error: toListenCountError },
  ] = await Promise.all([
    supabase
      .from('notification_events')
      .select('id, event_type, payload, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('to_listen_songs').select('id', { head: true, count: 'exact' }).eq('user_id', userId),
  ])

  throwIfError(notificationsError, 'Failed to load notifications')
  throwIfError(toListenCountError, 'Failed to load to-listen count')

  const rows = (notificationRows ?? []) as NotificationEventRow[]
  const relatedUserIds = new Set<string>()
  const recommendationIds = new Set<string>()

  for (const row of rows) {
    const payload = getPayloadObject(row.payload)
    if (row.event_type === 'recommendation_received') {
      const senderUserId = getPayloadString(payload, 'sender_user_id')
      if (senderUserId) {
        relatedUserIds.add(senderUserId)
      }

      const recommendationId = getPayloadString(payload, 'recommendation_id')
      if (recommendationId) {
        recommendationIds.add(recommendationId)
      }
    }

    if (row.event_type === 'recommendation_listened') {
      const listenerUserId = getPayloadString(payload, 'listener_user_id')
      if (listenerUserId) {
        relatedUserIds.add(listenerUserId)
      }
    }
  }

  const profileByUserId = new Map<string, { username: string | null; friendCode: string | null }>()
  if (relatedUserIds.size > 0) {
    const { data: profileRows, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, username, friend_code')
      .in('user_id', Array.from(relatedUserIds))

    throwIfError(profilesError, 'Failed to load notification users')

    for (const profile of profileRows ?? []) {
      profileByUserId.set(profile.user_id, {
        username: profile.username,
        friendCode: profile.friend_code,
      })
    }
  }

  const activeRecommendationIds = new Set<string>()
  if (recommendationIds.size > 0) {
    const { data: activeRecommendations, error: activeRecommendationsError } = await supabase
      .from('song_recommendations')
      .select('id')
      .eq('receiver_user_id', userId)
      .in('id', Array.from(recommendationIds))

    throwIfError(activeRecommendationsError, 'Failed to verify active recommendations')

    for (const recommendation of activeRecommendations ?? []) {
      activeRecommendationIds.add(recommendation.id)
    }
  }

  const notifications: ExploreNotification[] = rows.flatMap<ExploreNotification>((row) => {
    const payload = getPayloadObject(row.payload)
    const songName = getPayloadString(payload, 'song_name')
    const artistName = getPayloadString(payload, 'artist_name')

    if (!songName || !artistName) {
      return []
    }

    if (row.event_type === 'recommendation_received') {
      const senderUserId = getPayloadString(payload, 'sender_user_id')
      const recommendationId = getPayloadString(payload, 'recommendation_id')
      if (!senderUserId || !recommendationId) {
        return []
      }

      if (!activeRecommendationIds.has(recommendationId)) {
        return []
      }

      const profile = profileByUserId.get(senderUserId)
      return [
        {
          id: row.id,
          type: 'recommendation_received' as const,
          createdAt: row.created_at,
          songName,
          artistName,
          isOld: isOlderThanDays(row.created_at, REQUEST_OLD_AFTER_DAYS),
          friendDisplayName: buildFriendDisplayName(
            profile?.username ?? null,
            profile?.friendCode ?? null,
            senderUserId,
          ),
        },
      ]
    }

    const listenerUserId = getPayloadString(payload, 'listener_user_id')
    if (!listenerUserId) {
      return []
    }

    const profile = profileByUserId.get(listenerUserId)
    return [
      {
        id: row.id,
        type: 'recommendation_listened' as const,
        createdAt: row.created_at,
        songName,
        artistName,
        friendDisplayName: buildFriendDisplayName(
          profile?.username ?? null,
          profile?.friendCode ?? null,
          listenerUserId,
        ),
      },
    ]
  })

  const backlogCount = toListenCount ?? 0
  if (backlogCount > 0) {
    notifications.unshift({
      id: 'to_listen_backlog',
      type: 'to_listen_backlog',
      createdAt: new Date().toISOString(),
      count: backlogCount,
    })
  }

  return notifications
}
