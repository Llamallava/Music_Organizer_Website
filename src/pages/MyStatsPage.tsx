import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AlbumCover from '../components/AlbumCover'
import { formatScoreValue, GrandTotalWordsModule, TopTenAlbumsModule, TopTenSongsModule } from '../components/StatsModules'
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

const getDisplayName = (username: string | null | undefined) => username?.trim() || 'Unnamed User'
const toPossessiveName = (name: string) => (name.endsWith('s') || name.endsWith('S') ? `${name}'` : `${name}'s`)

function TopTenArtistsModule({ title, items, artistImages }: Omit<TopTenArtistModuleConfig, 'id' | 'moduleType'>) {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set())
  const firstArtist = items[0] ?? null
  const remainingArtists = items.slice(1)

  useEffect(() => {
    setLoadedImages(new Set())
  }, [artistImages])

  const isUrlsFetching = items.length > 0 && artistImages.size === 0
  const imagesWithUrls = items.filter((a) => artistImages.get(a.artistName) != null)
  const allLoaded = !isUrlsFetching && (imagesWithUrls.length === 0 || loadedImages.size >= imagesWithUrls.length)

  const handleImageLoad = (artistName: string) => {
    setLoadedImages((prev) => { const next = new Set(prev); next.add(artistName); return next })
  }

  return (
    <article className="vco-panel" style={{ position: 'relative', padding: 16 }}>
      {!allLoaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
          <div
            className="animate-spin"
            style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #2a2548', borderTopColor: '#c4b5fd' }}
          />
        </div>
      )}

      <div style={{ opacity: allLoaded ? 1 : 0, pointerEvents: allLoaded ? 'auto' : 'none', transition: 'opacity 0.5s' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#ede9fe', fontFamily: "'Sora', sans-serif" }}>{title}</h2>

        {!firstArtist && <p style={{ marginTop: 16, fontSize: 13, color: '#7c6fad' }}>No data yet.</p>}

        {firstArtist && (
          <>
            <div style={{ marginTop: 16, borderRadius: 6, border: '1px solid #2a2548', background: '#1c1836', padding: '10px 14px' }}>
              <p className="vco-label">#1</p>

              <div style={{ marginTop: 10, display: 'flex', gap: 12 }}>
                <div style={{ width: 80, height: 80, flexShrink: 0, overflow: 'hidden', borderRadius: 6, background: '#141028' }}>
                  <AlbumCover
                    src={artistImages.get(firstArtist.artistName) ?? null}
                    alt={`${firstArtist.artistName} profile`}
                    loading="eager"
                    onLoad={() => handleImageLoad(firstArtist.artistName)}
                  />
                </div>

                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 800, color: '#ede9fe', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {firstArtist.artistName}
                  </p>
                  <p style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: '#c4b5fd' }}>
                    Avg Score: {formatScoreValue(firstArtist.value)}
                  </p>
                  <p style={{ fontSize: 11, color: '#7c6fad' }}>
                    {firstArtist.albumCount} {firstArtist.albumCount === 1 ? 'album' : 'albums'} rated
                  </p>
                </div>
              </div>
            </div>

            <ol style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {remainingArtists.map((artist, index) => (
                <li
                  key={artist.artistName}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 4, background: '#1c1836', padding: '8px 10px' }}
                >
                  <div style={{ width: 36, height: 36, flexShrink: 0, overflow: 'hidden', borderRadius: 4, background: '#141028' }}>
                    <AlbumCover
                      src={artistImages.get(artist.artistName) ?? null}
                      alt={`${artist.artistName} profile`}
                      loading="eager"
                      onLoad={() => handleImageLoad(artist.artistName)}
                    />
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#ede9fe', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {index + 2}. {artist.artistName}
                    </p>
                    <p style={{ fontSize: 11, color: '#7c6fad' }}>
                      {artist.albumCount} {artist.albumCount === 1 ? 'album' : 'albums'} rated
                    </p>
                  </div>

                  <p style={{ flexShrink: 0, fontSize: 13, fontWeight: 600, color: '#c4b5fd' }}>
                    {formatScoreValue(artist.value)}
                  </p>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
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
    <main className="page-wrap">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 className="page-title" style={isFriendView ? { fontSize: 36, letterSpacing: '-0.02em' } : {}}>
          {isFriendView ? `${toPossessiveName(friendName ?? 'Friend')} Stats` : 'My Stats'}
        </h1>

        <button
          type="button"
          onClick={() => navigate('/artists')}
          className="vco-tbtn"
        >
          Your Artists
        </button>
      </div>

      {isLoading && <p className="vco-loading">Loading stats...</p>}

      {!isLoading && errorMessage && (
        <div className="vco-msg-err" style={{ marginTop: 20 }}>
          Could not load stats. {errorMessage}
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
    </main>
  )
}

export default MyStatsPage
