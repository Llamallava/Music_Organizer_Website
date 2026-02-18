import { useEffect, useState } from 'react'

type AlbumCoverProps = {
  src: string | null
  alt: string
  loading?: 'lazy' | 'eager'
}

function AlbumCover({ src, alt, loading = 'lazy' }: AlbumCoverProps) {
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
  }, [src])

  if (!src || hasError) {
    return (
      <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">
        No cover available
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      onError={() => setHasError(true)}
      className="h-full w-full object-cover"
    />
  )
}

export default AlbumCover
