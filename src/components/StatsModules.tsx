import { useEffect } from 'react'
import { animate, motion, useMotionValue, useTransform, type Variants } from 'framer-motion'
import AlbumCover from './AlbumCover'
import type { FavoriteWordStat, RankedAlbumStat, RankedSongStat } from '../lib/db/statsData'

export const formatScoreValue = (score: number) => score.toFixed(1).replace(/\.0$/, '')
export const formatValue = (value: number, valueType: 'score' | 'words') =>
  valueType === 'words' ? Math.round(value).toLocaleString() : formatScoreValue(value)

const rankLabel: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 9,
  letterSpacing: 2,
  textTransform: 'uppercase',
  color: '#7c6fad',
  marginBottom: 8,
}

const moduleTitle: React.CSSProperties = {
  fontFamily: "'Sora', sans-serif",
  fontSize: 15,
  fontWeight: 700,
  color: '#ede9fe',
  marginBottom: 4,
}

const innerCard: React.CSSProperties = {
  marginTop: 14,
  borderRadius: 6,
  border: '1px solid #2a2548',
  background: '#1c1836',
  padding: '10px 14px',
}

const listItem: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  borderRadius: 4,
  background: '#1c1836',
  padding: '8px 10px',
}

export const listContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045 } },
}

export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
}

function AnimatedCounter({ target }: { target: number }) {
  const count = useMotionValue(0)
  const display = useTransform(count, (v) => Math.round(v).toLocaleString())

  useEffect(() => {
    const controls = animate(count, target, { duration: 1.8, ease: [0.16, 1, 0.3, 1] })
    return controls.stop
  }, [target, count])

  return <motion.span>{display}</motion.span>
}

export function TopTenAlbumsModule({
  title,
  valueLabel,
  valueType,
  items,
}: {
  title: string
  valueLabel: string
  valueType: 'score' | 'words'
  items: RankedAlbumStat[]
}) {
  const firstAlbum = items[0] ?? null
  const remainingAlbums = items.slice(1)

  return (
    <article className="vco-panel" style={{ padding: 16 }}>
      <h2 style={moduleTitle}>{title}</h2>

      {!firstAlbum && <p style={{ marginTop: 16, fontSize: 13, color: '#7c6fad' }}>No data yet.</p>}

      {firstAlbum && (
        <>
          <div style={innerCard}>
            <p style={rankLabel}>#1</p>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 80, height: 80, flexShrink: 0, overflow: 'hidden', borderRadius: 6, background: '#141028' }}>
                <AlbumCover src={firstAlbum.coverUrl} alt={`${firstAlbum.title} cover`} loading="lazy" />
              </div>

              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: '#ede9fe', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {firstAlbum.title}
                </p>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#c4b5fd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {firstAlbum.artistName}
                </p>
                <p style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: '#ede9fe' }}>
                  {valueLabel}: {formatValue(firstAlbum.value, valueType)}
                </p>
              </div>
            </div>
          </div>

          <motion.ol
            variants={listContainerVariants}
            initial="hidden"
            animate="visible"
            style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}
          >
            {remainingAlbums.map((album, index) => {
              const rank = index + 2
              const imgSize = rank === 2 ? 42 : rank === 3 ? 34 : 0
              const itemPadding = rank === 2 ? '10px 12px' : '8px 10px'
              const titleSize = rank === 2 ? 14 : 13
              const titleWeight = rank === 2 ? 700 : 600
              return (
                <motion.li key={album.userSavedAlbumId} variants={listItemVariants} style={{ ...listItem, padding: itemPadding }}>
                  {imgSize > 0 && (
                    <div style={{ width: imgSize, height: imgSize, flexShrink: 0, overflow: 'hidden', borderRadius: 4, background: '#141028' }}>
                      <AlbumCover src={album.coverUrl} alt={`${album.title} cover`} loading="lazy" />
                    </div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: titleSize, fontWeight: titleWeight, color: '#ede9fe', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {rank}. {album.title}
                    </p>
                    <p style={{ fontSize: 11, color: '#7c6fad', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {album.artistName}
                    </p>
                  </div>
                  <p style={{ flexShrink: 0, fontSize: titleSize, fontWeight: 600, color: '#c4b5fd' }}>
                    {formatValue(album.value, valueType)}
                  </p>
                </motion.li>
              )
            })}
          </motion.ol>
        </>
      )}
    </article>
  )
}

export function TopTenSongsModule({
  title,
  valueLabel,
  valueType,
  items,
  showArtistName = true,
}: {
  title: string
  valueLabel: string
  valueType: 'score' | 'words'
  items: RankedSongStat[]
  showArtistName?: boolean
}) {
  const firstSong = items[0] ?? null
  const remainingSongs = items.slice(1)

  return (
    <article className="vco-panel" style={{ padding: 16 }}>
      <h2 style={moduleTitle}>{title}</h2>

      {!firstSong && <p style={{ marginTop: 16, fontSize: 13, color: '#7c6fad' }}>No data yet.</p>}

      {firstSong && (
        <>
          <div style={innerCard}>
            <p style={rankLabel}>#1</p>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 80, height: 80, flexShrink: 0, overflow: 'hidden', borderRadius: 6, background: '#141028' }}>
                <AlbumCover src={firstSong.coverUrl} alt={`${firstSong.albumTitle} cover`} loading="lazy" />
              </div>

              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: '#ede9fe', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {firstSong.trackTitle}
                </p>
                {showArtistName && (
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#c4b5fd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {firstSong.artistName}
                  </p>
                )}
                <p style={{ fontSize: 12, color: '#7c6fad', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {firstSong.albumTitle}
                </p>
                <p style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: '#ede9fe' }}>
                  {valueLabel}: {formatValue(firstSong.value, valueType)}
                </p>
              </div>
            </div>
          </div>

          <motion.ol
            variants={listContainerVariants}
            initial="hidden"
            animate="visible"
            style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}
          >
            {remainingSongs.map((song, index) => {
              const rank = index + 2
              const imgSize = rank === 2 ? 42 : rank === 3 ? 34 : 0
              const itemPadding = rank === 2 ? '10px 12px' : '8px 10px'
              const titleSize = rank === 2 ? 14 : 13
              const titleWeight = rank === 2 ? 700 : 600
              return (
                <motion.li key={`${song.userSavedAlbumId}:${song.trackNumber}`} variants={listItemVariants} style={{ ...listItem, padding: itemPadding }}>
                  {imgSize > 0 && (
                    <div style={{ width: imgSize, height: imgSize, flexShrink: 0, overflow: 'hidden', borderRadius: 4, background: '#141028' }}>
                      <AlbumCover src={song.coverUrl} alt={`${song.albumTitle} cover`} loading="lazy" />
                    </div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: titleSize, fontWeight: titleWeight, color: '#ede9fe', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {rank}. {song.trackTitle}
                    </p>
                    <p style={{ fontSize: 11, color: '#7c6fad', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {showArtistName ? `${song.artistName} - ${song.albumTitle}` : song.albumTitle}
                    </p>
                  </div>
                  <p style={{ flexShrink: 0, fontSize: titleSize, fontWeight: 600, color: '#c4b5fd' }}>
                    {formatValue(song.value, valueType)}
                  </p>
                </motion.li>
              )
            })}
          </motion.ol>
        </>
      )}
    </article>
  )
}

export function GrandTotalWordsModule({
  title,
  valueLabel,
  totalWords,
  favoriteWords,
  subtitle = 'Combined across all reviews on this account.',
}: {
  title: string
  valueLabel: string
  totalWords: number
  favoriteWords: FavoriteWordStat[]
  subtitle?: string
}) {
  return (
    <article className="vco-panel col-span-2" style={{ padding: 20 }}>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h2 style={moduleTitle}>{title}</h2>
          <p style={{ fontSize: 12, color: '#7c6fad', marginBottom: 16 }}>{subtitle}</p>
          <p style={{ fontSize: 36, fontWeight: 900, color: '#ede9fe', letterSpacing: '-0.02em', fontFamily: "'Sora', sans-serif" }}>
            <AnimatedCounter target={totalWords} />
          </p>
          <p style={{ marginTop: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#7c6fad' }}>
            {valueLabel}
          </p>
        </div>

        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#ede9fe' }}>Your favorite words:</p>
          {favoriteWords.length > 0 ? (
            <ul style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {favoriteWords.map((item, index) => (
                <li
                  key={item.word}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 4, background: '#1c1836', padding: '6px 10px', fontSize: 13 }}
                >
                  <span style={{ fontWeight: 600, color: '#ede9fe' }}>
                    {index + 1}. {item.word}
                  </span>
                  <span style={{ color: '#7c6fad' }}>{item.count.toLocaleString()}</span>
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
