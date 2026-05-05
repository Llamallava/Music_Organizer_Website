import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import AlbumCover from '../components/AlbumCover'
import LinearBackButton from '../components/LinearBackButton'
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
    <article className="rounded-xl border border-edge bg-surface p-4 shadow-sm">
      <h2 className="text-lg font-bold text-ink">{albumTitle}</h2>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Song Rankings by Score</p>

      {!firstSong && <p className="mt-4 text-sm text-ink-2">No scored tracks yet.</p>}

      {firstSong && (
        <>
          <div className="mt-4 rounded-lg border border-edge bg-surface-2 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">#1</p>

            <div className="mt-3 flex gap-3">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-surface-3">
                <AlbumCover src={coverUrl} alt={`${albumTitle} cover`} loading="lazy" />
              </div>

              <div className="min-w-0">
                <p className="truncate text-lg font-extrabold text-ink">{firstSong.trackTitle}</p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  Score: {formatScoreValue(firstSong.value)}
                </p>
              </div>
            </div>
          </div>

          <ol className="mt-4 space-y-2">
            {remainingSongs.map((song, index) => (
              <li
                key={`${song.userSavedAlbumId}:${song.trackNumber}`}
                className="flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-2"
              >
                <p className="truncate text-sm font-semibold text-ink">
                  {index + 2}. {song.trackTitle}
                </p>
                <p className="shrink-0 text-sm font-semibold text-ink">
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
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto w-full max-w-7xl">
        <LinearBackButton />

        <h1 className="mt-5 text-5xl font-black tracking-tight text-ink">{decodedName}</h1>

        {isLoading && <p className="mt-6 rounded-lg bg-surface p-4 text-sm text-ink">Loading stats...</p>}

        {!isLoading && errorMessage && (
          <div className="mt-6 rounded-lg border border-err-edge bg-err-bg p-4 text-sm text-err">
            <p>Could not load stats.</p>
            <p className="mt-1">{errorMessage}</p>
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
      </div>
    </main>
  )
}

export default ArtistDetailPage
