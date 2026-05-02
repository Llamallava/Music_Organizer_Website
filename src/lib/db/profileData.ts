import { supabase } from '../supabaseClient'

export const listCoversForHomeBackground = async (): Promise<string[]> => {
  const { data: authData } = await supabase.auth.getUser()
  const userId = authData.user?.id
  if (!userId) return []

  const { data: savedRows } = await supabase
    .from('user_saved_albums')
    .select('id, album_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (!savedRows || savedRows.length === 0) return []

  const albumIds = savedRows.map((r) => r.album_id)

  const { data: albumRows } = await supabase
    .from('albums')
    .select('id, cover_url')
    .in('id', albumIds)

  const coverByAlbumId = new Map(
    (albumRows ?? []).filter((a) => a.cover_url).map((a) => [a.id, a.cover_url!]),
  )

  const savedAlbumIds = savedRows.map((r) => r.id)

  const { data: sectionRows } = await supabase
    .from('review_sections')
    .select('user_saved_album_id, score, notes_lyrically, notes_sonically, updated_at')
    .in('user_saved_album_id', savedAlbumIds)

  type Entry = {
    coverUrl: string
    latestActivity: string
    avgScore: number
    notesLength: number
  }

  const entries: Entry[] = []

  for (const row of savedRows) {
    const coverUrl = coverByAlbumId.get(row.album_id)
    if (!coverUrl) continue

    const sections = (sectionRows ?? []).filter((s) => s.user_saved_album_id === row.id)

    let latestActivity = row.created_at
    let avgScore = 0
    let notesLength = 0

    if (sections.length > 0) {
      latestActivity = sections.reduce(
        (latest, s) => (s.updated_at > latest ? s.updated_at : latest),
        row.created_at,
      )

      const scored = sections.filter((s) => s.score !== null)
      avgScore =
        scored.length > 0
          ? scored.reduce((sum, s) => sum + (s.score ?? 0), 0) / scored.length
          : 0

      notesLength = sections.reduce((sum, s) => sum + (s.notes_lyrically?.length ?? 0) + (s.notes_sonically?.length ?? 0), 0)
    }

    entries.push({ coverUrl, latestActivity, avgScore, notesLength })
  }

  entries.sort((a, b) => {
    if (a.latestActivity !== b.latestActivity) {
      return a.latestActivity > b.latestActivity ? -1 : 1
    }
    const aQuality = a.avgScore * 10 + Math.log1p(a.notesLength)
    const bQuality = b.avgScore * 10 + Math.log1p(b.notesLength)
    return bQuality - aQuality
  })

  return entries.slice(0, 8).map((e) => e.coverUrl)
}

const requireAuthenticatedUserId = async () => {
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    throw new Error(`Failed to resolve current user: ${error.message}`)
  }
  const userId = data.user?.id
  if (!userId) {
    throw new Error('No authenticated user. Sign in first.')
  }
  return userId
}

export const getHomeBackgroundForCurrentUser = async (): Promise<string | null> => {
  const userId = await requireAuthenticatedUserId()

  const { data, error } = await supabase
    .from('profiles')
    .select('home_background_cover_url')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load profile: ${error.message}`)
  }

  return data?.home_background_cover_url ?? null
}

export const getAutoBackgroundEnabledForCurrentUser = async (): Promise<boolean> => {
  const userId = await requireAuthenticatedUserId()

  const { data, error } = await supabase
    .from('profiles')
    .select('auto_background_enabled')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load profile: ${error.message}`)
  }

  return data?.auto_background_enabled ?? true
}

export const setAutoBackgroundEnabledForCurrentUser = async (enabled: boolean): Promise<void> => {
  const { error } = await supabase.rpc('set_auto_background_enabled', { enabled })

  if (error) {
    throw new Error(`Failed to update setting: ${error.message}`)
  }
}

export const setHomeBackgroundForCurrentUser = async (coverUrl: string | null): Promise<void> => {
  const { error } = await supabase.rpc('set_home_background', { next_cover_url: coverUrl })

  if (error) {
    throw new Error(`Failed to set home background: ${error.message}`)
  }
}
