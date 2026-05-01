type GeniusSearchHit = {
  result?: {
    url?: string
    title?: string
    primary_artist?: {
      name?: string
    }
  }
}

type GeniusSearchResponse = {
  response?: {
    hits?: GeniusSearchHit[]
  }
}

type GeniusWebSearchSection = {
  type?: string
  hits?: GeniusSearchHit[]
}

type GeniusWebSearchResponse = {
  response?: {
    sections?: GeniusWebSearchSection[]
    hits?: GeniusSearchHit[]
  }
}

const GENIUS_API_BASE = 'https://api.genius.com'
const GENIUS_ACCESS_TOKEN = import.meta.env.VITE_GENIUS_ACCESS_TOKEN?.trim() ?? ''

let hasWarnedMissingGeniusToken = false

const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const fetchHtmlWithFallbacks = async (url: string): Promise<string> => {
  const attempts = [
    url,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
  ]

  for (const attemptUrl of attempts) {
    try {
      const response = await fetch(attemptUrl)
      if (!response.ok) {
        continue
      }

      const html = await response.text()
      if (html.trim()) {
        return html
      }
    } catch {
      // Try next fallback.
    }
  }

  return ''
}

const fetchJsonWithFallbacks = async (
  urls: string[],
  init?: RequestInit,
): Promise<GeniusSearchResponse | GeniusWebSearchResponse | null> => {
  for (const url of urls) {
    try {
      const response = await fetch(url, init)
      if (!response.ok) {
        continue
      }

      const json = (await response.json()) as GeniusSearchResponse | GeniusWebSearchResponse
      if (json && typeof json === 'object') {
        return json
      }
    } catch {
      // Try next fallback.
    }
  }

  return null
}

const getHitsFromSearchJson = (
  searchJson: GeniusSearchResponse | GeniusWebSearchResponse | null,
): GeniusSearchHit[] => {
  const response = searchJson?.response
  if (!response) {
    return []
  }

  const directHits = response.hits ?? []
  if (directHits.length > 0) {
    return directHits
  }

  const sections = (response as { sections?: GeniusWebSearchSection[] }).sections ?? []
  const songSection = sections.find((section: GeniusWebSearchSection) => section.type?.toLowerCase() === 'song')
  if (songSection?.hits && songSection.hits.length > 0) {
    return songSection.hits
  }

  for (const section of sections) {
    if (section.hits && section.hits.length > 0) {
      return section.hits
    }
  }

  return []
}

const findBestHitUrl = (hits: GeniusSearchHit[], songName: string, artistName?: string): string | null => {
  if (hits.length === 0) {
    return null
  }

  const normalizedSongName = normalize(songName)
  const normalizedArtist = normalize(artistName ?? '')

  const scoredHits = hits
    .map((hit, index) => {
      const url = hit.result?.url
      if (!url) {
        return { index, score: Number.NEGATIVE_INFINITY, url: null as string | null }
      }

      const hitArtist = normalize(hit.result?.primary_artist?.name ?? '')
      const hitTitle = normalize(hit.result?.title ?? '')

      let score = 0

      if (normalizedArtist && hitArtist) {
        if (hitArtist === normalizedArtist) {
          score += 6
        } else if (hitArtist.includes(normalizedArtist) || normalizedArtist.includes(hitArtist)) {
          score += 3
        }
      }

      if (normalizedSongName && hitTitle) {
        if (hitTitle === normalizedSongName) {
          score += 6
        } else if (hitTitle.includes(normalizedSongName) || normalizedSongName.includes(hitTitle)) {
          score += 3
        }
      }

      return { index, score, url }
    })
    .sort((a, b) => {
      if (b.score === a.score) {
        return a.index - b.index
      }
      return b.score - a.score
    })

  return scoredHits[0]?.url ?? hits[0]?.result?.url ?? null
}

const fetchSearchHits = async (
  query: string,
  token: string,
  hasToken: boolean,
): Promise<GeniusSearchHit[]> => {
  const officialUrl = `${GENIUS_API_BASE}/search?q=${query}`
  if (hasToken) {
    const officialJson = await fetchJsonWithFallbacks(
      [
        officialUrl,
        `https://corsproxy.io/?${encodeURIComponent(officialUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(officialUrl)}`,
      ],
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    )

    const officialHits = getHitsFromSearchJson(officialJson)
    if (officialHits.length > 0) {
      return officialHits
    }
  }

  const webUrl = `https://genius.com/api/search/song?q=${query}`
  const webJson = await fetchJsonWithFallbacks([
    webUrl,
    `https://corsproxy.io/?${encodeURIComponent(webUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(webUrl)}`,
  ])

  return getHitsFromSearchJson(webJson)
}

const extractLyricsFromHtml = (html: string): string => {
  if (!html.trim()) {
    return ''
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const nodes = Array.from(doc.querySelectorAll("div[data-lyrics-container='true']"))

  if (nodes.length === 0) {
    return ''
  }

  const extractTextWithSeparator = (node: Element): string => {
    const lines: string[] = []
    let currentLine = ''

    const flushLine = (): void => {
      lines.push(currentLine.trim())
      currentLine = ''
    }

    const BLOCK_TAGS = new Set(['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr'])

    const walk = (current: Node): void => {
      if (current.nodeType === 3) {
        currentLine += (current.nodeValue ?? '').replace(/\u00a0/g, ' ')
        return
      }

      if (current.nodeType !== 1) return

      const tag = (current as Element).tagName.toLowerCase()
      if (tag === 'br') {
        flushLine()
        return
      }

      const isBlock = BLOCK_TAGS.has(tag)
      if (isBlock && currentLine.trim()) {
        flushLine()
      }

      for (const child of Array.from(current.childNodes)) {
        walk(child)
      }

      if (isBlock && currentLine.trim()) {
        flushLine()
      }
    }

    walk(node)
    if (currentLine.trim()) {
      flushLine()
    }

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  }

  const extractContainerText = (node: Element): string => {
    return extractTextWithSeparator(node).replace(/\r\n?/g, '\n').trim()
  }

  return nodes
    .map((node) => extractContainerText(node))
    .filter((line) => line.length > 0)
    .join('\n')
}

const NOISE_LINE_PATTERNS: RegExp[] = [
  /^\s*you\s+might\s+also\s+like\s*$/i,
  /^\s*embed\s*$/i,
  /^\s*\d+\s*embed\s*$/i,
  /^\s*return\s+to\s+.*\s+lyrics\s*$/i,
  /^\s*\d+\s+contributors?.*$/i,
  /^\s*\d+(\.\d+)?[kmb]?\s+views?.*$/i,
]

const LEADING_NOISE_PATTERNS: RegExp[] = [
  /^\s*\d+\s+contributors?.*$/i,
  /^\s*.*\blyrics\b\s*$/i,
  /^\s*translations?\s*$/i,
  /^\s*romanizations?\s*$/i,
]

const isNoiseLine = (line: string): boolean => NOISE_LINE_PATTERNS.some((pattern) => pattern.test(line))
const isLeadingNoiseLine = (line: string): boolean =>
  LEADING_NOISE_PATTERNS.some((pattern) => pattern.test(line))

const cleanGeniusLyrics = (lyrics: string): string => {
  let normalized = lyrics
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()

  // Genius often prefixes the first line with site chrome; strip only the chrome text.
  normalized = normalized
    .replace(/^\s*\d+\s+contributors?.*?lyrics\b\s*/i, '')
    .replace(/^\s*lyrics\b\s*/i, '')
    .replace(/^\s*paroles?\s+de\s+la\s+chanson\b\s*/i, '')

  const rawLines = normalized.split('\n').map((line) => line.trim())

  while (rawLines.length > 0 && isLeadingNoiseLine(rawLines[0])) {
    rawLines.shift()
  }

  const cleanedLines: string[] = []

  for (const line of rawLines) {
    if (isNoiseLine(line)) {
      continue
    }

    if (!line) {
      const last = cleanedLines[cleanedLines.length - 1]
      if (!last) {
        continue
      }
      cleanedLines.push('')
      continue
    }

    cleanedLines.push(line)
  }

  while (cleanedLines[0] === '') {
    cleanedLines.shift()
  }
  while (cleanedLines[cleanedLines.length - 1] === '') {
    cleanedLines.pop()
  }

  return cleanedLines.join('\n').trim()
}

const warnMissingGeniusTokenOnce = (): void => {
  if (hasWarnedMissingGeniusToken) {
    return
  }

  hasWarnedMissingGeniusToken = true
  console.warn('VITE_GENIUS_ACCESS_TOKEN is not set. Attempting Genius lookup with fallback token value.')
}

export const getLyricsAsync = async (songName: string, artistName = ''): Promise<string> => {
  const trimmedSongName = songName.trim()
  const trimmedArtistName = artistName.trim()

  if (!trimmedSongName) {
    return ''
  }

  const hasToken = Boolean(GENIUS_ACCESS_TOKEN)
  const token = GENIUS_ACCESS_TOKEN || 'PUT_TOKEN_HERE'
  if (!hasToken) {
    warnMissingGeniusTokenOnce()
  }

  const query = encodeURIComponent(
    trimmedArtistName ? `${trimmedArtistName} ${trimmedSongName}` : trimmedSongName,
  )

  try {
    const hits = await fetchSearchHits(query, token, hasToken)
    const url = findBestHitUrl(hits, trimmedSongName, trimmedArtistName)?.trim() ?? ''

    if (!url) {
      return ''
    }

    const html = await fetchHtmlWithFallbacks(url)
    if (!html) {
      return ''
    }

    const lyrics = extractLyricsFromHtml(html)
    return cleanGeniusLyrics(lyrics)
  } catch {
    return ''
  }
}
