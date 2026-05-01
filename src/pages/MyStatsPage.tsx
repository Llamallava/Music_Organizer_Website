import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AlbumCover from '../components/AlbumCover'
import LinearBackButton from '../components/LinearBackButton'
import { getFriendsOverviewForCurrentUser } from '../lib/db/friendsData'
import {
  type FavoriteWordStat,
  getStatsForUser,
  getMyStatsForCurrentUser,
  type MyStatsData,
  type RankedAlbumStat,
  type RankedArtistStat,
  type RankedSongStat,
} from '../lib/db/statsData'
import { getArtistImageUrls } from '../lib/external/spotifyArtistImages'

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

type TopTenArtistModuleConfig = {
  id: string
  moduleType: 'artist'
  title: string
  items: RankedArtistStat[]
  artistImages: Map<string, string | null>
}

type TopTenModuleConfig = TopTenAlbumModuleConfig | TopTenSongModuleConfig | GrandTotalWordsModuleConfig | TopTenArtistModuleConfig

const formatScoreValue = (score: number) => score.toFixed(1).replace(/\.0$/, '')
const formatValue = (value: number, valueType: 'score' | 'words') =>
  valueType === 'words' ? Math.round(value).toLocaleString() : formatScoreValue(value)
const getDisplayName = (username: string | null | undefined) => username?.trim() || 'Unnamed User'
const toPossessiveName = (name: string) => (name.endsWith('s') || name.endsWith('S') ? `${name}'` : `${name}'s`)

function TopTenAlbumsModule({
  title,
  valueLabel,
  valueType,
  items,
}: Omit<TopTenAlbumModuleConfig, 'id' | 'moduleType'>) {
  const firstAlbum = items[0] ?? null
  const remainingAlbums = items.slice(1)

  return (
    <article className="rounded-xl border border-edge bg-surface p-4 shadow-sm">
      <h2 className="text-lg font-bold text-ink">{title}</h2>

      {!firstAlbum && <p className="mt-4 text-sm text-ink-2">No data yet.</p>}

      {firstAlbum && (
        <>
          <div className="mt-4 rounded-lg border border-edge bg-surface-2 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">#1</p>

            <div className="mt-3 flex gap-3">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-surface-3">
                <AlbumCover src={firstAlbum.coverUrl} alt={`${firstAlbum.title} cover`} loading="lazy" />
              </div>

              <div className="min-w-0">
                <p className="truncate text-lg font-extrabold text-ink">{firstAlbum.title}</p>
                <p className="truncate text-base font-semibold text-ink">{firstAlbum.artistName}</p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {valueLabel}: {formatValue(firstAlbum.value, valueType)}
                </p>
              </div>
            </div>
          </div>

          <ol className="mt-4 space-y-2">
            {remainingAlbums.map((album, index) => (
              <li
                key={album.userSavedAlbumId}
                className="flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {index + 2}. {album.title}
                  </p>
                  <p className="truncate text-xs text-ink-2">{album.artistName}</p>
                </div>

                <p className="shrink-0 text-sm font-semibold text-ink">
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
    <article className="rounded-xl border border-edge bg-surface p-4 shadow-sm">
      <h2 className="text-lg font-bold text-ink">{title}</h2>

      {!firstSong && <p className="mt-4 text-sm text-ink-2">No data yet.</p>}

      {firstSong && (
        <>
          <div className="mt-4 rounded-lg border border-edge bg-surface-2 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">#1</p>

            <div className="mt-3 flex gap-3">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-surface-3">
                <AlbumCover src={firstSong.coverUrl} alt={`${firstSong.albumTitle} cover`} loading="lazy" />
              </div>

              <div className="min-w-0">
                <p className="truncate text-lg font-extrabold text-ink">{firstSong.trackTitle}</p>
                <p className="truncate text-base font-semibold text-ink">{firstSong.artistName}</p>
                <p className="truncate text-sm text-ink-2">{firstSong.albumTitle}</p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {valueLabel}: {formatValue(firstSong.value, valueType)}
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
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {index + 2}. {song.trackTitle}
                  </p>
                  <p className="truncate text-xs text-ink-2">{song.artistName} - {song.albumTitle}</p>
                </div>

                <p className="shrink-0 text-sm font-semibold text-ink">
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
    <article className="col-span-2 rounded-xl border border-edge bg-surface p-5 shadow-sm">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <p className="mt-1 text-sm text-ink-2">Combined across all reviews on this account.</p>
          <p className="mt-4 text-4xl font-black tracking-tight text-ink">
            {formatValue(totalWords, 'words')}
          </p>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-ink-3">{valueLabel}</p>
        </div>

        <div>
          <p className="text-sm font-semibold text-ink">Your favorite words:</p>
          {favoriteWords.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {favoriteWords.map((item, index) => (
                <li
                  key={item.word}
                  className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2 text-sm"
                >
                  <span className="font-semibold text-ink">
                    {index + 1}. {item.word}
                  </span>
                  <span className="text-ink-2">{item.count.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-2">No words yet.</p>
          )}
        </div>
      </div>
    </article>
  )
}

function TopTenArtistsModule({ title, items, artistImages }: Omit<TopTenArtistModuleConfig, 'id' | 'moduleType'>) {
  const firstArtist = items[0] ?? null
  const remainingArtists = items.slice(1)

  return (
    <article className="rounded-xl border border-edge bg-surface p-4 shadow-sm">
      <h2 className="text-lg font-bold text-ink">{title}</h2>

      {!firstArtist && <p className="mt-4 text-sm text-ink-2">No data yet.</p>}

      {firstArtist && (
        <>
          <div className="mt-4 rounded-lg border border-edge bg-surface-2 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">#1</p>

            <div className="mt-3 flex gap-3">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-surface-3">
                <AlbumCover
                  src={artistImages.get(firstArtist.artistName) ?? null}
                  alt={`${firstArtist.artistName} profile`}
                  loading="lazy"
                />
              </div>

              <div className="min-w-0">
                <p className="truncate text-lg font-extrabold text-ink">{firstArtist.artistName}</p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  Avg Score: {formatScoreValue(firstArtist.value)}
                </p>
                <p className="text-xs text-ink-3">
                  {firstArtist.albumCount} {firstArtist.albumCount === 1 ? 'album' : 'albums'} rated
                </p>
              </div>
            </div>
          </div>

          <ol className="mt-4 space-y-2">
            {remainingArtists.map((artist, index) => (
              <li
                key={artist.artistName}
                className="flex items-center gap-3 rounded-md bg-surface-2 px-3 py-2"
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-surface-3">
                  <AlbumCover
                    src={artistImages.get(artist.artistName) ?? null}
                    alt={`${artist.artistName} profile`}
                    loading="lazy"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {index + 2}. {artist.artistName}
                  </p>
                  <p className="text-xs text-ink-3">
                    {artist.albumCount} {artist.albumCount === 1 ? 'album' : 'albums'} rated
                  </p>
                </div>

                <p className="shrink-0 text-sm font-semibold text-ink">{formatScoreValue(artist.value)}</p>
              </li>
            ))}
          </ol>
        </>
      )}
    </article>
  )
}

function MyStatsPage() {
  const navigate = useNavigate()
  const { friendUserId } = useParams<{ friendUserId: string }>()
  const isFriendView = Boolean(friendUserId)
  const [statsData, setStatsData] = useState<MyStatsData | null>(null)
  const [friendName, setFriendName] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [artistImages, setArtistImages] = useState<Map<string, string | null>>(new Map())

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
          if (!isActive) {
            return
          }

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
        if (!isActive) {
          return
        }

        setStatsData(data)
        setFriendName(null)
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
  }, [friendUserId])

  useEffect(() => {
    if (!statsData?.topArtistsByScore.length) {
      return
    }

    let isActive = true
    const names = statsData.topArtistsByScore.map((a) => a.artistName)

    void getArtistImageUrls(names).then((images) => {
      if (isActive) {
        setArtistImages(images)
      }
    })

    return () => {
      isActive = false
    }
  }, [statsData])

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
      {
        id: 'top-10-artists',
        moduleType: 'artist',
        title: 'Top 10 Artists',
        items: statsData?.topArtistsByScore ?? [],
        artistImages,
      },
    ]
  }, [statsData, artistImages])

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <LinearBackButton />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate('/artists')}
              className="rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-white"
            >
              Your Artists
            </button>

            <button
              type="button"
              onClick={() => navigate('/reviews')}
              className="rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-white"
            >
              Go to Reviews
            </button>
          </div>
        </div>

        <h1 className={`mt-5 font-black text-ink ${isFriendView ? 'text-5xl tracking-tight' : 'text-3xl'}`}>
          {isFriendView ? `${toPossessiveName(friendName ?? 'Friend')} Stats` : 'My Stats'}
        </h1>

        {isLoading && <p className="mt-6 rounded-lg bg-surface p-4 text-sm text-ink">Loading stats...</p>}

        {!isLoading && errorMessage && (
          <div className="mt-6 rounded-lg border border-err-edge bg-err-bg p-4 text-sm text-err">
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
              ) : module.moduleType === 'artist' ? (
                <TopTenArtistsModule
                  key={module.id}
                  title={module.title}
                  items={module.items}
                  artistImages={module.artistImages}
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
