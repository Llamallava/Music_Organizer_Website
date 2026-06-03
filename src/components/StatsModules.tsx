import { useEffect } from 'react'
import { animate, motion, useMotionValue, useTransform, type Variants } from 'framer-motion'
import AlbumCover from './AlbumCover'
import type { FavoriteWordStat, RankedAlbumStat, RankedArtistStat, RankedSongStat } from '../lib/db/statsData'

export const formatScoreValue = (score: number) => score.toFixed(1).replace(/\.0$/, '')
export const formatValue = (value: number, valueType: 'score' | 'words') =>
  valueType === 'words' ? Math.round(value).toLocaleString() : formatScoreValue(value)

export const listContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045 } },
}

export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
}

export function AnimatedCounter({ target }: { target: number }) {
  const count = useMotionValue(0)
  const display = useTransform(count, (v) => Math.round(v).toLocaleString())

  useEffect(() => {
    const controls = animate(count, target, { duration: 1.8, ease: [0.16, 1, 0.3, 1] })
    return controls.stop
  }, [target, count])

  return <motion.span>{display}</motion.span>
}

// ── AlmanacList ────────────────────────────────────────────────────────────────

export type AlmanacRow = {
  id: string
  rank: number
  title: string
  secondary?: string
  value: string
  /** Optional cover/image URL — renders a 44px thumbnail for rank-1 rows only */
  coverUrl?: string | null
}

export function AlmanacList({
  rows,
  animate: shouldAnimate = true,
  emptyText = 'No data yet.',
}: {
  rows: AlmanacRow[]
  animate?: boolean
  emptyText?: string
}) {
  const noMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const doAnimate = shouldAnimate && !noMotion

  if (rows.length === 0) {
    return (
      <p
        style={{
          fontSize: 13,
          color: '#8b7fb8',
          fontFamily: "'JetBrains Mono', monospace",
          marginTop: 8,
        }}
      >
        {emptyText}
      </p>
    )
  }

  return (
    <motion.ol
      className="na-list"
      variants={doAnimate ? listContainerVariants : undefined}
      initial={doAnimate ? 'hidden' : undefined}
      animate={doAnimate ? 'visible' : undefined}
    >
      {rows.map((row) => (
        <motion.li
          key={row.id}
          className="na-list-row"
          variants={doAnimate ? listItemVariants : undefined}
        >
          <span className="na-list-rank">{String(row.rank).padStart(2, '0')}</span>
          <div
            style={{
              minWidth: 0,
              display: 'flex',
              alignItems: row.rank === 1 && row.coverUrl ? 'center' : 'flex-start',
              gap: row.rank === 1 && row.coverUrl ? 10 : 0,
            }}
          >
            {row.rank === 1 && row.coverUrl && (
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 6,
                  overflow: 'hidden',
                  flexShrink: 0,
                  background: '#141028',
                  border: '1px solid rgba(139,92,246,0.2)',
                }}
              >
                <AlbumCover src={row.coverUrl} alt={row.title} loading="eager" />
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <p className="na-list-title">{row.title}</p>
              {row.secondary && <p className="na-list-sub">{row.secondary}</p>}
            </div>
          </div>
          <span className="na-list-value">{row.value}</span>
        </motion.li>
      ))}
    </motion.ol>
  )
}

// ── Row adapters ───────────────────────────────────────────────────────────────

export function albumsToRows(
  albums: RankedAlbumStat[],
  valueType: 'score' | 'words',
  startRank = 1,
): AlmanacRow[] {
  return albums.map((album, i) => ({
    id: album.userSavedAlbumId,
    rank: startRank + i,
    title: album.title,
    secondary: album.artistName,
    value: formatValue(album.value, valueType),
    coverUrl: album.coverUrl,
  }))
}

export function songsToRows(
  songs: RankedSongStat[],
  valueType: 'score' | 'words',
  showArtist = true,
  startRank = 1,
): AlmanacRow[] {
  return songs.map((song, i) => ({
    id: `${song.userSavedAlbumId}:${song.trackNumber}`,
    rank: startRank + i,
    title: song.trackTitle,
    secondary: showArtist ? `${song.artistName} — ${song.albumTitle}` : song.albumTitle,
    value: formatValue(song.value, valueType),
    coverUrl: song.coverUrl,
  }))
}

export function artistsToRows(
  artists: RankedArtistStat[],
  imageMap?: Map<string, string | null>,
): AlmanacRow[] {
  const hasImages = imageMap && imageMap.size > 0
  return artists.map((artist, i) => ({
    id: artist.artistName,
    rank: i + 1,
    title: artist.artistName,
    secondary: `${artist.albumCount} ${artist.albumCount === 1 ? 'album' : 'albums'} rated`,
    value: formatScoreValue(artist.value),
    ...(hasImages ? { coverUrl: imageMap!.get(artist.artistName) ?? null } : {}),
  }))
}

// ── Kept for backwards compatibility (unused after redesign) ──────────────────

export function GrandTotalWordsModule({
  totalWords,
  favoriteWords,
  subtitle = 'Combined across all reviews on this account.',
}: {
  title?: string
  valueLabel?: string
  totalWords: number
  favoriteWords: FavoriteWordStat[]
  subtitle?: string
}) {
  return (
    <article className="vco-panel col-span-2" style={{ padding: 20 }}>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <p
            style={{
              fontSize: 36,
              fontWeight: 900,
              background: 'linear-gradient(135deg, #e0d7ff 0%, #a78bfa 55%, #38bdf8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.02em',
              fontFamily: "'Sora', sans-serif",
            }}
          >
            <AnimatedCounter target={totalWords} />
          </p>
          <p
            style={{
              marginTop: 4,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: '#7c6fad',
            }}
          >
            {subtitle}
          </p>
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#ede9fe' }}>Your favorite words:</p>
          {favoriteWords.length > 0 ? (
            <ul style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {favoriteWords.map((item, index) => (
                <li
                  key={item.word}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderRadius: 4,
                    background: 'rgba(20, 16, 40, 0.7)',
                    border: '1px solid rgba(42, 37, 72, 0.9)',
                    padding: '6px 10px',
                    fontSize: 13,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: '#ede9fe',
                    }}
                  >
                    {index + 1}. {item.word}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#7c6fad' }}>
                    {item.count.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ marginTop: 8, fontSize: 13, color: '#7c6fad' }}>No words yet.</p>
          )}
        </div>
      </div>
    </article>
  )
}
