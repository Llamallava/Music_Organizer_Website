import { useEffect, useState } from 'react'

export type AccentColor = { h: number; s: number; l: number }

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2

  if (max === min) return { h: 0, s: 0, l }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h: number
  switch (max) {
    case rn:
      h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
      break
    case gn:
      h = ((bn - rn) / d + 2) / 6
      break
    default:
      h = ((rn - gn) / d + 4) / 6
  }

  return { h: h * 360, s, l }
}

function extractAccentFromImage(img: HTMLImageElement): AccentColor | null {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.drawImage(img, 0, 0, size, size)

  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, size, size).data
  } catch {
    return null
  }

  const counts  = new Int32Array(36)
  const hueSums = new Float64Array(36)
  const satSums = new Float64Array(36)
  const litSums = new Float64Array(36)

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue

    const { h, s, l } = rgbToHsl(data[i], data[i + 1], data[i + 2])
    const bucket = Math.floor(h / 10) % 36

    counts[bucket]++
    hueSums[bucket] += h
    satSums[bucket] += s
    litSums[bucket] += l
  }

  let bestCount = 0
  let best = -1
  for (let i = 0; i < 36; i++) {
    if (counts[i] > bestCount) {
      bestCount = counts[i]
      best = i
    }
  }
  if (best === -1) return null

  const n = counts[best]
  return {
    h: Math.round(hueSums[best] / n),
    s: Math.round((satSums[best] / n) * 100),
    l: Math.round((litSums[best] / n) * 100),
  }
}

export function useAlbumAccent(coverUrl: string | null | undefined): AccentColor | null {
  const [accent, setAccent] = useState<AccentColor | null>(null)

  useEffect(() => {
    if (!coverUrl) {
      setAccent(null)
      return
    }

    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      if (cancelled) return
      setAccent(extractAccentFromImage(img))
    }

    img.onerror = () => {
      if (cancelled) return
      setAccent(null)
    }

    img.src = coverUrl

    return () => {
      cancelled = true
      img.onload = null
      img.onerror = null
    }
  }, [coverUrl])

  return accent
}
