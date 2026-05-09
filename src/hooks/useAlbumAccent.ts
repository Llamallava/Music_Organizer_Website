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

function pickWinner(
  counts: Int32Array,
  hueSums: Float64Array,
  satSums: Float64Array,
  litSums: Float64Array,
  weightSums: Float64Array,
): AccentColor | null {
  let bestWeight = 0
  let best = -1
  for (let i = 0; i < 36; i++) {
    if (weightSums[i] > bestWeight) {
      bestWeight = weightSums[i]
      best = i
    }
  }
  if (best === -1 || counts[best] === 0) return null

  const n = counts[best]
  const avgS = satSums[best] / n
  const avgL = litSums[best] / n

  // Use the actual color from the image.
  // Only nudge enough so it's readable on a dark background:
  //   - L below 45% is invisible; boost it. Above 90% can wash out; cap it.
  //   - S below 20% reads as gray; nudge it up just enough to show a hue.
  const s = Math.max(20, Math.round(avgS * 100))
  const l = Math.max(45, Math.min(90, Math.round(avgL * 100)))

  return { h: Math.round(hueSums[best] / n), s, l }
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

  // Phase 1 — vivid (s ≥ 0.4): bold accent colors like a red smoke trail.
  // Phase 2 — ambient (s ≥ 0.1): fallback for muted/atmospheric covers
  //   where the dominant color is desaturated (e.g. a soft teal background).
  const vividCount  = new Int32Array(36)
  const vividHue    = new Float64Array(36)
  const vividSat    = new Float64Array(36)
  const vividLit    = new Float64Array(36)
  const vividW      = new Float64Array(36)

  const ambCount    = new Int32Array(36)
  const ambHue      = new Float64Array(36)
  const ambSat      = new Float64Array(36)
  const ambLit      = new Float64Array(36)
  const ambW        = new Float64Array(36)

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue

    const { h, s, l } = rgbToHsl(data[i], data[i + 1], data[i + 2])

    if (l < 0.12) continue // skip near-black; light/pastel colors are welcome

    const bucket = Math.floor(h / 10) % 36

    if (s >= 0.4) {
      vividCount[bucket]++
      vividHue[bucket] += h
      vividSat[bucket] += s
      vividLit[bucket] += l
      vividW[bucket]   += s
    }

    if (s >= 0.1) {
      ambCount[bucket]++
      ambHue[bucket]  += h
      ambSat[bucket]  += s
      ambLit[bucket]  += l
      ambW[bucket]    += s
    }
  }

  // Only trust the vivid result if it has enough coverage — prevents tiny
  // logos or text elements from hijacking the color.
  const minVividPixels = size * size * 0.005
  const vividResult = pickWinner(vividCount, vividHue, vividSat, vividLit, vividW)
  if (vividResult !== null) {
    const topBucket = vividCount.indexOf(Math.max(...vividCount))
    if (vividCount[topBucket] >= minVividPixels) return vividResult
  }

  return pickWinner(ambCount, ambHue, ambSat, ambLit, ambW)
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
