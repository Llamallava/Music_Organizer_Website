import { useNavigate } from 'react-router-dom'

function MyStuffPage() {
  const navigate = useNavigate()

  return (
    <main style={{ display: 'flex', minHeight: 'calc(100vh - var(--nav-h))', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 360 }}>
        <button type="button" onClick={() => navigate('/reviews')} className="vco-tbtn primary">
          My Reviews
        </button>
        <button type="button" onClick={() => navigate('/search')} className="vco-tbtn">
          Search
        </button>
        <button type="button" onClick={() => navigate('/stats')} className="vco-tbtn">
          My Stats
        </button>
        <button type="button" onClick={() => navigate('/to-listen')} className="vco-tbtn">
          To-Listen
        </button>
      </div>
    </main>
  )
}

export default MyStuffPage
