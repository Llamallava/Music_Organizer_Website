type AlbumCoversResponse = {
  covers: (string | null)[]
}

const cache = new Map<string, string | null>()

const makeCacheKey = (artistName: string, albumTitle: string) =>
  `${artistName.toLowerCase()}::${albumTitle.toLowerCase()}`

const getEdgeFunctionUrl = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables.')
  }

  const base = new URL('/functions/v1/spotify-album-covers', supabaseUrl).toString()
  return { url: base, anonKey: supabaseAnonKey }
}

export const getAlbumCoverUrls = async (
  albums: Array<{ artistName: string; albumTitle: string }>,
): Promise<(string | null)[]> => {
  const uncachedIndices = albums
    .map((album, i) => ({ album, i }))
    .filter(({ album }) => !cache.has(makeCacheKey(album.artistName, album.albumTitle)))

  if (uncachedIndices.length > 0) {
    try {
      const { url, anonKey } = getEdgeFunctionUrl()

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ albums: uncachedIndices.map(({ album }) => album) }),
      })

      if (response.ok) {
        const payload = (await response.json()) as AlbumCoversResponse
        uncachedIndices.forEach(({ album }, j) => {
          cache.set(makeCacheKey(album.artistName, album.albumTitle), payload.covers[j] ?? null)
        })
      }
    } catch (error) {
      console.error('[spotifyAlbumCovers] error:', error)
    }

    for (const { album } of uncachedIndices) {
      const key = makeCacheKey(album.artistName, album.albumTitle)
      if (!cache.has(key)) {
        cache.set(key, null)
      }
    }
  }

  return albums.map(({ artistName, albumTitle }) => cache.get(makeCacheKey(artistName, albumTitle)) ?? null)
}
