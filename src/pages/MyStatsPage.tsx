import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AlbumCover from '../components/AlbumCover'
import LinearBackButton from '../components/LinearBackButton'
import {
  type FavoriteWordStat,
  getMyStatsForCurrentUser,
  type MyStatsData,
  type RankedAlbumStat,
  type RankedSongStat,
} from '../lib/db/statsData'

type TopTenAlbumModuleConfig = {
  id: string
  moduleType: 'album'
  title: string
  valueLabel: string
  valueType: 'score' | 'words'
  items: RankedAlbumStat[]
}

type TopTenSongModuleConfig = {
  id: string
  moduleType: 'song'
  title: string
  valueLabel: string
  valueType: 'score' | 'words'
  items: RankedSongStat[]
}

type GrandTotalWordsModuleConfig = {
  id: string
  moduleType: 'grand-total-words'
  title: string
  valueLabel: string
  totalWords: number
  favoriteWords: FavoriteWordStat[]
}

type TopTenModuleConfig = TopTenAlbumModuleConfig | TopTenSongModuleConfig | GrandTotalWordsModuleConfig

const formatScoreValue = (score: number) => score.toFixed(1).replace(/\.0$/, '')
const formatValue = (value: number, valueType: 'score' | 'words') =>
  valueType === 'words' ? Math.round(value).toLocaleString() : formatScoreValue(value)

function TopTenAlbumsModule({
  title,
  valueLabel,
  valueType,
  items,
}: Omit<TopTenAlbumModuleConfig, 'id' | 'moduleType'>) {
  const firstAlbum = items[0] ?? null
  const remainingAlbums = items.slice(1)

  return (
    <article className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>

      {!firstAlbum && <p className="mt-4 text-sm text-slate-600">No data yet.</p>}

      {firstAlbum && (
        <>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">#1</p>

            <div className="mt-3 flex gap-3">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-200">
                <AlbumCover src={firstAlbum.coverUrl} alt={`${firstAlbum.title} cover`} loading="lazy" />
              </div>

              <div className="min-w-0">
                <p className="truncate text-lg font-extrabold text-slate-900">{firstAlbum.title}</p>
                <p className="truncate text-base font-semibold text-slate-700">{firstAlbum.artistName}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {valueLabel}: {formatValue(firstAlbum.value, valueType)}
                </p>
              </div>
            </div>
          </div>

          <ol className="mt-4 space-y-2">
            {remainingAlbums.map((album, index) => (
              <li
                key={album.userSavedAlbumId}
                className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {index + 2}. {album.title}
                  </p>
                  <p className="truncate text-xs text-slate-600">{album.artistName}</p>
                </div>

                <p className="shrink-0 text-sm font-semibold text-slate-900">
                  {formatValue(album.value, valueType)}
                </p>
              </li>
            ))}
          </ol>
        </>
      )}
    </article>
  )
}

function TopTenSongsModule({
  title,
  valueLabel,
  valueType,
  items,
}: Omit<TopTenSongModuleConfig, 'id' | 'moduleType'>) {
  const firstSong = items[0] ?? null
  const remainingSongs = items.slice(1)

  return (
    <article className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>

      {!firstSong && <p className="mt-4 text-sm text-slate-600">No data yet.</p>}

      {firstSong && (
        <>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">#1</p>

            <div className="mt-3 flex gap-3">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-200">
                <AlbumCover src={firstSong.coverUrl} alt={`${firstSong.albumTitle} cover`} loading="lazy" />
              </div>

              <div className="min-w-0">
                <p className="truncate text-lg font-extrabold text-slate-900">{firstSong.trackTitle}</p>
                <p className="truncate text-base font-semibold text-slate-700">{firstSong.artistName}</p>
                <p className="truncate text-sm text-slate-600">{firstSong.albumTitle}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {valueLabel}: {formatValue(firstSong.value, valueType)}
                </p>
              </div>
            </div>
          </div>

          <ol className="mt-4 space-y-2">
            {remainingSongs.map((song, index) => (
              <li
                key={`${song.userSavedAlbumId}:${song.trackNumber}`}
                className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {index + 2}. {song.trackTitle}
                  </p>
                  <p className="truncate text-xs text-slate-600">{song.artistName} - {song.albumTitle}</p>
                </div>

                <p className="shrink-0 text-sm font-semibold text-slate-900">
                  {formatValue(song.value, valueType)}
                </p>
              </li>
            ))}
          </ol>
        </>
      )}
    </article>
  )
}

function GrandTotalWordsModule({
  title,
  valueLabel,
  totalWords,
  favoriteWords,
}: Omit<GrandTotalWordsModuleConfig, 'id' | 'moduleType'>) {
  return (
    <article className="col-span-2 rounded-xl border border-slate-200 bg-white/90 p-5 shadow-sm">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">Combined across all reviews on this account.</p>
          <p className="mt-4 text-4xl font-black tracking-tight text-slate-900">
            {formatValue(totalWords, 'words')}
          </p>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-slate-500">{valueLabel}</p>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">Your favorite words:</p>
          {favoriteWords.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {favoriteWords.map((item, index) => (
                <li
                  key={item.word}
                  className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="font-semibold text-slate-900">
                    {index + 1}. {item.word}
                  </span>
                  <span className="text-slate-600">{item.count.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-600">No words yet.</p>
          )}
        </div>
      </div>
    </article>
  )
}

function MyStatsPage() {
  const navigate = useNavigate()
  const [statsData, setStatsData] = useState<MyStatsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    const loadStats = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const data = await getMyStatsForCurrentUser()
        if (!isActive) {
          return
        }

        setStatsData(data)
      } catch (error) {
        if (!isActive) {
          return
        }

        const message = error instanceof Error ? error.message : 'Failed to load stats.'
        setErrorMessage(message)
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadStats()

    return () => {
      isActive = false
    }
  }, [])

  const modules = useMemo<TopTenModuleConfig[]>(() => {
    return [
      {
        id: 'top-10-by-score',
        moduleType: 'album',
        title: 'Top 10 Albums by Score',
        valueLabel: 'Score',
        valueType: 'score',
        items: statsData?.topAlbumsByConclusionScore ?? [],
      },
      {
        id: 'top-10-by-average',
        moduleType: 'album',
        title: 'Top 10 Albums by Average',
        valueLabel: 'Average',
        valueType: 'score',
        items: statsData?.topAlbumsByTrackAverage ?? [],
      },
      {
        id: 'top-10-songs-by-score',
        moduleType: 'song',
        title: 'Top 10 Songs by Score',
        valueLabel: 'Score',
        valueType: 'score',
        items: statsData?.topSongsByScore ?? [],
      },
      {
        id: 'top-10-interlude-songs',
        moduleType: 'song',
        title: 'Top 10 Interlude Songs',
        valueLabel: 'Score',
        valueType: 'score',
        items: statsData?.topInterludeSongs ?? [],
      },
      {
        id: 'top-10-albums-by-words',
        moduleType: 'album',
        title: 'Top 10 Albums by Words Written',
        valueLabel: 'Words',
        valueType: 'words',
        items: statsData?.topAlbumsByWordsWritten ?? [],
      },
      {
        id: 'top-10-songs-by-words',
        moduleType: 'song',
        title: 'Top 10 Songs by Words Written',
        valueLabel: 'Words',
        valueType: 'words',
        items: statsData?.topSongsByWordsWritten ?? [],
      },
      {
        id: 'grand-total-words-written',
        moduleType: 'grand-total-words',
        title: 'Grand Total of Words Written',
        valueLabel: 'Total Words Written',
        totalWords: statsData?.grandTotalWordsWritten ?? 0,
        favoriteWords: statsData?.favoriteWords ?? [],
      },
    ]
  }, [statsData])

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <LinearBackButton />

          <button
            type="button"
            onClick={() => navigate('/reviews')}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Go to Reviews
          </button>
        </div>

        <h1 className="mt-5 text-3xl font-black text-slate-900">My Stats</h1>
        <p className="mt-2 text-sm text-slate-700">
          This page uses modular 2-column cards so additional stat modules can be added easily.
        </p>

        {isLoading && <p className="mt-6 rounded-lg bg-white p-4 text-sm text-slate-700">Loading stats...</p>}

        {!isLoading && errorMessage && (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <p>Could not load stats.</p>
            <p className="mt-1">{errorMessage}</p>
          </div>
        )}

        {!isLoading && !errorMessage && (
          <section className="mt-6 grid grid-cols-2 gap-4">
            {modules.map((module) => (
              module.moduleType === 'album' ? (
                <TopTenAlbumsModule
                  key={module.id}
                  title={module.title}
                  valueLabel={module.valueLabel}
                  valueType={module.valueType}
                  items={module.items}
                />
              ) : module.moduleType === 'song' ? (
                <TopTenSongsModule
                  key={module.id}
                  title={module.title}
                  valueLabel={module.valueLabel}
                  valueType={module.valueType}
                  items={module.items}
                />
              ) : (
                <GrandTotalWordsModule
                  key={module.id}
                  title={module.title}
                  valueLabel={module.valueLabel}
                  totalWords={module.totalWords}
                  favoriteWords={module.favoriteWords}
                />
              )
            ))}
          </section>
        )}
      </div>
    </main>
  )
}

export default MyStatsPage
