import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import AlbumCover from '../components/AlbumCover'
import {
  formatScoreValue,
  GrandTotalWordsModule,
  TopTenAlbumsModule,
  TopTenSongsModule,
} from '../components/StatsModules'
import {
  getArtistStatsForCurrentUser,
  type AlbumSongRanking,
  type ArtistStatsData,
} from '../lib/db/statsData'

function AlbumSongRankingModule({ albumTitle, coverUrl, songs }: AlbumSongRanking) {
  const firstSong = songs[0] ?? null
  const remainingSongs = songs.slice(1)

  return (
    <article className="vco-panel" style={{ padding: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#ede9fe', fontFamily: "'Sora', sans-serif", marginBottom: 4 }}>
        {albumTitle}
      </h2>
      <p className="vco-label">Song Rankings by Score</p>

      {!firstSong && <p style={{ marginTop: 16, fontSize: 13, color: '#7c6fad' }}>No scored tracks yet.</p>}

      {firstSong && (
        <>
          <div style={{ marginTop: 16, borderRadius: 6, border: '1px solid #2a2548', background: '#1c1836', padding: '10px 14px' }}>
            <p className="vco-label">#1</p>

            <div style={{ marginTop: 10, display: 'flex', gap: 12 }}>
              <div style={{ width: 80, height: 80, flexShrink: 0, overflow: 'hidden', borderRadius: 6, background: '#141028' }}>
                <AlbumCover src={coverUrl} alt={`${albumTitle} cover`} loading="lazy" />
              </div>

              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: '#ede9fe', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {firstSong.trackTitle}
                </p>
                <p style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: '#c4b5fd' }}>
                  Score: {formatScoreValue(firstSong.value)}
                </p>
              </div>
            </div>
          </div>

          <ol style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {remainingSongs.map((song, index) => (
              <li
                key={`${song.userSavedAlbumId}:${song.trackNumber}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 4, background: '#1c1836', padding: '8px 12px' }}
              >
                <p style={{ fontSize: 13, fontWeight: 600, color: '#ede9fe', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {index + 2}. {song.trackTitle}
                </p>
                <p style={{ flexShrink: 0, fontSize: 13, fontWeight: 600, color: '#c4b5fd' }}>
                  {formatScoreValue(song.value)}
                </p>
              </li>
            ))}
          </ol>
        </>
      )}
    </article>
  )
}

function ArtistDetailPage() {
  const { artistName } = useParams<{ artistName: string }>()
  const decodedName = artistName ? decodeURIComponent(artistName) : 'Unknown Artist'

  const [statsData, setStatsData] = useState<ArtistStatsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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

    return () => {
      isActive = false
    }
  }, [decodedName])

  return (
    <main className="page-wrap">
      <h1 className="page-title" style={{ fontSize: 40, letterSpacing: '-0.02em' }}>{decodedName}</h1>

      {isLoading && <p className="vco-loading">Loading stats...</p>}

      {!isLoading && errorMessage && (
        <div className="vco-msg-err" style={{ marginTop: 20 }}>
          Could not load stats. {errorMessage}
        </div>
      )}

      {!isLoading && !errorMessage && (
        <section className="mt-6 grid grid-cols-2 gap-4">
          <TopTenAlbumsModule
            title="Top 10 Albums by Score"
            valueLabel="Score"
            valueType="score"
            items={statsData?.topAlbumsByConclusionScore ?? []}
          />
          <TopTenAlbumsModule
            title="Top 10 Albums by Average"
            valueLabel="Average"
            valueType="score"
            items={statsData?.topAlbumsByTrackAverage ?? []}
          />
          <TopTenSongsModule
            title="Top 10 Songs by Score"
            valueLabel="Score"
            valueType="score"
            items={statsData?.topSongsByScore ?? []}
            showArtistName={false}
          />
          <TopTenSongsModule
            title="Top 10 Interlude Songs"
            valueLabel="Score"
            valueType="score"
            items={statsData?.topInterludeSongs ?? []}
            showArtistName={false}
          />
          <TopTenAlbumsModule
            title="Top 10 Albums by Words Written"
            valueLabel="Words"
            valueType="words"
            items={statsData?.topAlbumsByWordsWritten ?? []}
          />
          <TopTenSongsModule
            title="Top 10 Songs by Words Written"
            valueLabel="Words"
            valueType="words"
            items={statsData?.topSongsByWordsWritten ?? []}
            showArtistName={false}
          />
          <GrandTotalWordsModule
            title="Grand Total of Words Written"
            valueLabel="Total Words Written"
            totalWords={statsData?.grandTotalWordsWritten ?? 0}
            favoriteWords={statsData?.favoriteWords ?? []}
            subtitle={`Combined across all ${decodedName} reviews on this account.`}
          />
          {(statsData?.albumSongRankings ?? []).map((ranking) => (
            <AlbumSongRankingModule key={ranking.userSavedAlbumId} {...ranking} />
          ))}
        </section>
      )}
    </main>
  )
}

export default ArtistDetailPage
