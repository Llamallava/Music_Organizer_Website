import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import AlbumCover from '../components/AlbumCover'
import Starfield from '../components/Starfield'
import { StellarHorizon } from '../components/StellarHorizon'
import {
  AlmanacList,
  type AlmanacRow,
  albumsToRows,
  AnimatedCounter,
  formatScoreValue,
  songsToRows,
} from '../components/StatsModules'
import {
  getArtistStatsForCurrentUser,
  type AlbumSongRanking,
  type ArtistStatsData,
} from '../lib/db/statsData'

// ── Nebula wash behind the hero cover (shared with MyStatsPage) ───────────────

function NebulaCover({
  coverUrl,
  alt,
}: {
  coverUrl: string | null
  alt: string
}) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div
        aria-hidden
        style={{ position: 'absolute', inset: -56, zIndex: 0, pointerEvents: 'none' }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 50% 50%, rgba(167,139,250,0.45) 0%, transparent 68%)',
            filter: 'blur(28px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 24,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 60% 40%, rgba(56,189,248,0.28) 0%, transparent 70%)',
            filter: 'blur(22px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 40,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 40% 60%, rgba(244,114,182,0.18) 0%, transparent 70%)',
            filter: 'blur(30px)',
          }}
        />
      </div>
      <div className="na-hero-cover-wrap" style={{ position: 'relative', zIndex: 1 }}>
        <AlbumCover src={coverUrl} alt={alt} loading="eager" />
      </div>
    </div>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function AlmanacSection({
  numeral,
  title,
  subLabel,
  dividerLabel,
  children,
}: {
  numeral: string
  title: string
  subLabel: string
  dividerLabel: string
  children: React.ReactNode
}) {
  return (
    <>
      <StellarHorizon label={dividerLabel} />
      <div className="na-section-header">
        <span className="na-roman">{numeral}</span>
        <h2 className="na-section-title">{title}</h2>
        <span className="na-section-sub">{subLabel}</span>
      </div>
      {children}
    </>
  )
}

// ── Almanac card panel ─────────────────────────────────────────────────────────

function AlmanacCard({ label, rows }: { label: string; rows: AlmanacRow[] }) {
  return (
    <div className="na-card" style={{ padding: '16px 20px' }}>
      <p className="na-card-heading">{label}</p>
      <AlmanacList rows={rows} />
    </div>
  )
}

// ── Per-album song ranking ─────────────────────────────────────────────────────

function AlbumRankingCard({ ranking }: { ranking: AlbumSongRanking }) {
  const rows = ranking.songs.map((song, i) => ({
    id: `${song.userSavedAlbumId}:${song.trackNumber}`,
    rank: i + 1,
    title: song.trackTitle,
    value: formatScoreValue(song.value),
  }))

  return (
    <div className="na-card" style={{ padding: '16px 20px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 6,
            overflow: 'hidden',
            background: '#141028',
            flexShrink: 0,
          }}
        >
          <AlbumCover src={ranking.coverUrl} alt={`${ranking.albumTitle} cover`} loading="lazy" />
        </div>
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: 13,
              fontWeight: 700,
              color: '#f2efff',
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {ranking.albumTitle}
          </p>
          <p className="na-col-label" style={{ margin: '2px 0 0' }}>
            Song Rankings by Score
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p
          style={{
            fontSize: 13,
            color: '#8b7fb8',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          No scored tracks yet.
        </p>
      ) : (
        <AlmanacList rows={rows} />
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

function ArtistDetailPage() {
  const { artistName } = useParams<{ artistName: string }>()
  const decodedName = artistName ? decodeURIComponent(artistName) : 'Unknown Artist'

  const [statsData, setStatsData] = useState<ArtistStatsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [minElapsed, setMinElapsed] = useState(false)

  useEffect(() => {
    setMinElapsed(false)
    const id = setTimeout(() => setMinElapsed(true), 650)
    return () => clearTimeout(id)
  }, [decodedName])

  useEffect(() => {
    let isActive = true

    const loadStats = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const data = await getArtistStatsForCurrentUser(decodedName)
        if (!isActive) return
        setStatsData(data)
      } catch (error) {
        if (!isActive) return
        const message = error instanceof Error ? error.message : 'Failed to load stats.'
        setErrorMessage(message)
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    void loadStats()
    return () => { isActive = false }
  }, [decodedName])

  const topAlbumsByScore = statsData?.topAlbumsByConclusionScore ?? []
  const heroAlbum = topAlbumsByScore[0] ?? null

  return (
    <div className="na-page">
      <Starfield opacity={0.55} seed={10245} />

      <main className="na-content">
        {/* ── Masthead ── */}
        <div
          style={{
            textAlign: 'center',
            paddingTop: 48,
            paddingBottom: 8,
          }}
        >
          <h1
            style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: 52,
              fontWeight: 800,
              color: '#f2efff',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            {decodedName}
          </h1>
        </div>

        {/* ── Loading / Error / Content ── */}
        <AnimatePresence mode="wait">
          {(isLoading || !minElapsed) ? (
            <motion.p
              key="loading"
              className="vco-loading"
              style={{ marginTop: 40, textAlign: 'center' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
            >
              Loading stats…
            </motion.p>
          ) : errorMessage ? (
            <motion.div
              key="error"
              className="vco-msg-err"
              style={{ marginTop: 24, marginLeft: 0, marginRight: 0 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
            >
              Could not load stats. {errorMessage}
            </motion.div>
          ) : statsData ? (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            >
          <>
            {/* ── Hero: Top Albums by Score ── */}
            <StellarHorizon label="I · THE VAULT" />

            {heroAlbum ? (
              <div className="na-hero">
                <div className="na-hero-left">
                  <NebulaCover
                    coverUrl={heroAlbum.coverUrl}
                    alt={`${heroAlbum.title} cover`}
                  />
                  <div style={{ textAlign: 'center', marginTop: 18 }}>
                    <p
                      style={{
                        fontFamily: "'Sora', sans-serif",
                        fontSize: 15,
                        fontWeight: 700,
                        color: '#f2efff',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 300,
                      }}
                    >
                      {heroAlbum.title}
                    </p>
                    <p
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11,
                        color: '#8b7fb8',
                        marginTop: 4,
                      }}
                    >
                      {heroAlbum.artistName}
                    </p>
                  </div>
                </div>

                <div className="na-hero-right">
                  <div>
                    <p className="na-kicker" style={{ marginBottom: 4 }}>
                      Top Albums · BY CONCLUSION SCORE
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 10,
                        marginTop: 4,
                      }}
                    >
                      <span className="na-display-num" style={{ fontSize: 88 }}>
                        {formatScoreValue(heroAlbum.value)}
                      </span>
                      <div>
                        <p
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 13,
                            color: '#8b7fb8',
                            margin: 0,
                          }}
                        >
                          / 10
                        </p>
                        <p className="na-col-label" style={{ margin: 0 }}>
                          SCORE
                        </p>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 24 }}>
                    <AlmanacList
                      rows={albumsToRows(topAlbumsByScore.slice(1), 'score', 2)}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p
                style={{
                  margin: '40px 0',
                  fontSize: 13,
                  color: '#8b7fb8',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                No scored albums yet.
              </p>
            )}

            {/* ── II · Songs ── */}
            <AlmanacSection
              numeral="II"
              title="Songs"
              subLabel="BY SCORE"
              dividerLabel="II · SONGS"
            >
              <div className="na-2col">
                <AlmanacCard
                  label="Top Songs by Score"
                  rows={songsToRows(statsData.topSongsByScore, 'score', false)}
                />
                <AlmanacCard
                  label="Top Interlude Songs"
                  rows={songsToRows(statsData.topInterludeSongs, 'score', false)}
                />
              </div>
            </AlmanacSection>

            {/* ── III · Albums ── */}
            <AlmanacSection
              numeral="III"
              title="Albums"
              subLabel="BY AVERAGE & WORDS"
              dividerLabel="III · ALBUMS"
            >
              <div className="na-2col">
                <AlmanacCard
                  label="Albums by Average"
                  rows={albumsToRows(statsData.topAlbumsByTrackAverage, 'score')}
                />
                <AlmanacCard
                  label="Albums by Words Written"
                  rows={albumsToRows(statsData.topAlbumsByWordsWritten, 'words')}
                />
              </div>
            </AlmanacSection>

            {/* ── IV · Words Written ── */}
            <AlmanacSection
              numeral="IV"
              title="Words Written"
              subLabel="BY COUNT"
              dividerLabel="IV · WORDS WRITTEN"
            >
              <div className="na-2col">
                <AlmanacCard
                  label="Songs by Words"
                  rows={songsToRows(statsData.topSongsByWordsWritten, 'words', false)}
                />
                {/* second col: ledger preview or empty placeholder */}
                <div />
              </div>
            </AlmanacSection>

            {/* ── Album song rankings ── */}
            {statsData.albumSongRankings.length > 0 && (
              <>
                <StellarHorizon label="V · SONG RANKINGS" />
                <div className="na-section-header">
                  <span className="na-roman">V</span>
                  <h2 className="na-section-title">Song Rankings</h2>
                  <span className="na-section-sub">PER ALBUM</span>
                </div>
                <div className="na-2col" style={{ marginBottom: 0 }}>
                  {statsData.albumSongRankings.map((ranking) => (
                    <AlbumRankingCard key={ranking.userSavedAlbumId} ranking={ranking} />
                  ))}
                </div>
              </>
            )}

            {/* ── Ledger ── */}
            <StellarHorizon label="THE LEDGER" />
            <div className="na-card na-ledger" style={{ marginTop: 16 }}>
              <div>
                <p className="na-kicker" style={{ marginBottom: 6 }}>
                  Words Written
                </p>
                <p
                  className="na-display-num"
                  style={{ fontSize: 68, display: 'block', lineHeight: 1 }}
                >
                  <AnimatedCounter target={statsData.grandTotalWordsWritten} />
                </p>
                <p className="na-col-label" style={{ marginTop: 8 }}>
                  {`Combined across all ${decodedName} reviews`}
                </p>
              </div>

              <div>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#f2efff',
                    fontFamily: "'Sora', sans-serif",
                    marginBottom: 14,
                  }}
                >
                  Favorite words
                </p>
                {statsData.favoriteWords.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {statsData.favoriteWords.map((item) => (
                      <span key={item.word} className="na-word-pill">
                        {item.word}
                        <span style={{ color: '#38bdf8', opacity: 0.6 }}>·</span>
                        {item.count.toLocaleString()}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p
                    style={{
                      fontSize: 13,
                      color: '#8b7fb8',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    No words yet.
                  </p>
                )}
              </div>
            </div>
          </>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
    </div>
  )
}

export default ArtistDetailPage
