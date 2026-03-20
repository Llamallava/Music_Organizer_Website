import { useParams } from 'react-router-dom'
import LinearBackButton from '../components/LinearBackButton'

function ArtistDetailPage() {
  const { artistName } = useParams<{ artistName: string }>()
  const decodedName = artistName ? decodeURIComponent(artistName) : 'Unknown Artist'

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto w-full max-w-7xl">
        <LinearBackButton />

        <h1 className="mt-5 text-5xl font-black tracking-tight text-slate-900">{decodedName}</h1>
      </div>
    </main>
  )
}

export default ArtistDetailPage
