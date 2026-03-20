type ArtistImagesResponse = {
  images: Record<string, string | null>
}

const cache = new Map<string, string | null>()

const getEdgeFunctionUrl = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables.')
  }

  const base = new URL('/functions/v1/spotify-artist-images', supabaseUrl).toString()
  return { url: base, anonKey: supabaseAnonKey }
}

export const getArtistImageUrls = async (artistNames: string[]): Promise<Map<string, string | null>> => {
  const uncached = artistNames.filter((name) => !cache.has(name.toLowerCase()))
  console.log('[spotifyArtistImages] requested:', artistNames, '| uncached:', uncached)

  if (uncached.length > 0) {
    try {
      const { url, anonKey } = getEdgeFunctionUrl()
      console.log('[spotifyArtistImages] calling:', url)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ artistNames: uncached }),
      })

      console.log('[spotifyArtistImages] response status:', response.status)
      const text = await response.text()
      console.log('[spotifyArtistImages] response body:', text)

      if (response.ok) {
        const payload = JSON.parse(text) as ArtistImagesResponse
        for (const [name, imageUrl] of Object.entries(payload.images)) {
          cache.set(name.toLowerCase(), imageUrl)
        }
      }
    } catch (error) {
      console.error('[spotifyArtistImages] error:', error)
    }

    for (const name of uncached) {
      if (!cache.has(name.toLowerCase())) {
        cache.set(name.toLowerCase(), null)
      }
    }
  }

  const result = new Map(artistNames.map((name) => [name, cache.get(name.toLowerCase()) ?? null]))
  console.log('[spotifyArtistImages] final result:', Object.fromEntries(result))
  return result
}
