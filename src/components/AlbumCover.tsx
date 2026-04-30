import { useEffect, useState } from 'react'

type AlbumCoverProps = {
  src: string | null
  alt: string
  loading?: 'lazy' | 'eager'
  onLoad?: () => void
}

function AlbumCover({ src, alt, loading = 'lazy', onLoad }: AlbumCoverProps) {
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
  }, [src])

  if (!src || hasError) {
    return (
      <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-ink-3">
        No cover available
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      onLoad={onLoad}
      onError={() => { setHasError(true); onLoad?.() }}
      className="h-full w-full object-cover"
    />
  )
}

export default AlbumCover
