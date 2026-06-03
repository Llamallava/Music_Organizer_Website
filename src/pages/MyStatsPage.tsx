import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import AlbumCover from '../components/AlbumCover'
import Starfield from '../components/Starfield'
import { StellarHorizon } from '../components/StellarHorizon'
import {
  AlmanacList,
  type AlmanacRow,
  albumsToRows,
  AnimatedCounter,
  artistsToRows,
  formatScoreValue,
  songsToRows,
} from '../components/StatsModules'
import { getFriendsOverviewForCurrentUser } from '../lib/db/friendsData'
import {
  getMyStatsForCurrentUser,
  getStatsForUser,
  type MyStatsData,
} from '../lib/db/statsData'
import { getArtistImageUrls } from '../lib/external/spotifyArtistImages'

const getDisplayName = (username: string | null | undefined) => username?.trim() || 'Unnamed User'
const toPossessiveName = (name: string) =>
  name.endsWith('s') || name.endsWith('S') ? `${name}'` : `${name}'s`

// ── Nebula wash behind the hero cover ─────────────────────────────────────────

function NebulaCover({
  coverUrl,
  alt,
}: {
  coverUrl: string | null
  alt: string
}) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* blurred radial washes behind the cover */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: -56,
          zIndex: 0,
          pointerEvents: 'none',
        }}
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

function AlmanacCard({
  label,
  rows,
  isLoading = false,
}: {
  label: string
  rows: AlmanacRow[]
  isLoading?: boolean
}) {
  return (
    <div className="na-card" style={{ padding: '16px 20px', position: 'relative' }}>
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 10,
          }}
        >
          <div
            className="animate-spin"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: '2px solid #1b1640',
              borderTopColor: '#38bdf8',
            }}
          />
        </div>
      )}
      <div style={{ opacity: isLoading ? 0.35 : 1, transition: 'opacity 0.4s' }}>
        <p className="na-card-heading">{label}</p>
        <AlmanacList rows={rows} />
      </div>
    </div>
  )
}

// ── Ledger ─────────────────────────────────────────────────────────────────────

function AlmanacLedger({ data }: { data: MyStatsData }) {
  return (
    <>
      <StellarHorizon label="THE LEDGER" />
      <div className="na-card na-ledger" style={{ marginTop: 16 }}>
        <div>
          <p className="na-kicker" style={{ marginBottom: 6 }}>Words Written</p>
          <p
            className="na-display-num"
            style={{ fontSize: 68, display: 'block', lineHeight: 1 }}
          >
            <AnimatedCounter target={data.grandTotalWordsWritten} />
          </p>
          <p
            className="na-col-label"
            style={{ marginTop: 8 }}
          >
            Total words written
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
            Your favorite words
          </p>
          {data.favoriteWords.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.favoriteWords.map((item) => (
                <span key={item.word} className="na-word-pill">
                  {item.word}
                  <span style={{ color: '#38bdf8', opacity: 0.6 }}>·</span>
                  {item.count.toLocaleString()}
                </span>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: '#8b7fb8', fontFamily: "'JetBrains Mono', monospace" }}>
              No words yet.
            </p>
          )}
        </div>
      </div>
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

function MyStatsPage() {
  const navigate = useNavigate()
  const { friendUserId } = useParams<{ friendUserId: string }>()
  const isFriendView = Boolean(friendUserId)

  const [statsData, setStatsData] = useState<MyStatsData | null>(null)
  const [friendName, setFriendName] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [artistImages, setArtistImages] = useState<Map<string, string | null>>(new Map())
  const [minElapsed, setMinElapsed] = useState(false)

  useEffect(() => {
    setMinElapsed(false)
    const id = setTimeout(() => setMinElapsed(true), 650)
    return () => clearTimeout(id)
  }, [friendUserId])

  useEffect(() => {
    let isActive = true

    const loadStats = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        if (friendUserId) {
          const [data, overview] = await Promise.all([
            getStatsForUser(friendUserId),
            getFriendsOverviewForCurrentUser(),
          ])
          if (!isActive) return

          const friend = overview.friends.find((entry) => entry.userId === friendUserId)
          if (!friend) {
            setStatsData(null)
            setFriendName(null)
            setErrorMessage('This friend is not in your current list.')
            return
          }

          setStatsData(data)
          setFriendName(getDisplayName(friend.username))
          return
        }

        const data = await getMyStatsForCurrentUser()
        if (!isActive) return
        setStatsData(data)
        setFriendName(null)
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
  }, [friendUserId])

  useEffect(() => {
    if (!statsData?.topArtistsByScore.length) return
    let isActive = true
    const names = statsData.topArtistsByScore.map((a) => a.artistName)
    void getArtistImageUrls(names).then((images) => {
      if (isActive) setArtistImages(images)
    })
    return () => { isActive = false }
  }, [statsData])

  const isArtistImagesLoading =
    (statsData?.topArtistsByScore.length ?? 0) > 0 && artistImages.size === 0

  const pageTitle = isFriendView
    ? `${toPossessiveName(friendName ?? 'Friend')} Stats`
    : 'My Stats'

  const topAlbumsByScore = statsData?.topAlbumsByConclusionScore ?? []
  const heroAlbum = topAlbumsByScore[0] ?? null

  return (
    <div className="na-page">
      <Starfield opacity={0.55} seed={85023} />

      <main className="na-content">
        {/* ── Masthead ── */}
        <div
          style={{
            textAlign: 'center',
            paddingTop: 48,
            paddingBottom: 8,
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', top: 52, right: 0 }}>
            <button type="button" onClick={() => navigate('/artists')} className="vco-tbtn">
              Your Artists
            </button>
          </div>

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
            {pageTitle}
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
                {/* ── Hero: Top 10 Albums by Score ── */}
                <StellarHorizon />

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
                        <p
                          className="na-kicker"
                          style={{ marginBottom: 4 }}
                        >
                          Top 10 Albums · BY CONCLUSION SCORE
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
                    No scored albums yet. Start writing reviews to see your stats here.
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
                      rows={songsToRows(statsData.topSongsByScore, 'score', true)}
                    />
                    <AlmanacCard
                      label="Top Interlude Songs"
                      rows={songsToRows(statsData.topInterludeSongs, 'score', true)}
                    />
                  </div>
                </AlmanacSection>

                {/* ── III · Albums & Artists ── */}
                <AlmanacSection
                  numeral="III"
                  title="Albums & Artists"
                  subLabel="BY AVERAGE & SCORE"
                  dividerLabel="III · ALBUMS & ARTISTS"
                >
                  <div className="na-2col">
                    <AlmanacCard
                      label="Albums by Average"
                      rows={albumsToRows(statsData.topAlbumsByTrackAverage, 'score')}
                    />
                    <AlmanacCard
                      label="Top Artists"
                      rows={artistsToRows(statsData.topArtistsByScore, artistImages)}
                      isLoading={isArtistImagesLoading}
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
                      label="Albums by Words"
                      rows={albumsToRows(statsData.topAlbumsByWordsWritten, 'words')}
                    />
                    <AlmanacCard
                      label="Songs by Words"
                      rows={songsToRows(statsData.topSongsByWordsWritten, 'words', true)}
                    />
                  </div>
                </AlmanacSection>

                {/* ── Ledger ── */}
                <AlmanacLedger data={statsData} />
              </>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
    </div>
  )
}

export default MyStatsPage
