import AlbumCover from './AlbumCover'
import type { FavoriteWordStat, RankedAlbumStat, RankedSongStat } from '../lib/db/statsData'

export const formatScoreValue = (score: number) => score.toFixed(1).replace(/\.0$/, '')
export const formatValue = (value: number, valueType: 'score' | 'words') =>
  valueType === 'words' ? Math.round(value).toLocaleString() : formatScoreValue(value)

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
                {showArtistName && (
                  <p className="truncate text-base font-semibold text-ink">{firstSong.artistName}</p>
                )}
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
                  <p className="truncate text-xs text-ink-2">
                    {showArtistName ? `${song.artistName} - ${song.albumTitle}` : song.albumTitle}
                  </p>
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
    <article className="col-span-2 rounded-xl border border-edge bg-surface p-5 shadow-sm">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <p className="mt-1 text-sm text-ink-2">{subtitle}</p>
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
