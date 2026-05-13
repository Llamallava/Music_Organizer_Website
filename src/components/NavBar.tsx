import { generatePath, matchPath, useLocation, useNavigate } from 'react-router-dom'
import AccountMenu from './AccountMenu'
import { useAuthSession } from '../hooks/useAuthSession'

type BackRoute = { pattern: string; previousPath: string }

const BACK_ROUTES: BackRoute[] = [
  { pattern: '/auth', previousPath: '/' },
  { pattern: '/reviews', previousPath: '/' },
  { pattern: '/reviews/add', previousPath: '/reviews' },
  { pattern: '/reviews/:userSavedAlbumId', previousPath: '/reviews' },
  { pattern: '/stats', previousPath: '/' },
  { pattern: '/artists', previousPath: '/stats' },
  { pattern: '/artists/:artistName', previousPath: '/artists' },
  { pattern: '/search', previousPath: '/' },
  { pattern: '/friends', previousPath: '/' },
  { pattern: '/friends/:friendUserId', previousPath: '/friends' },
  { pattern: '/friends/:friendUserId/reviews', previousPath: '/friends/:friendUserId' },
  { pattern: '/friends/:friendUserId/reviews/:userSavedAlbumId', previousPath: '/friends/:friendUserId/reviews' },
  { pattern: '/friends/:friendUserId/stats', previousPath: '/friends/:friendUserId' },
  { pattern: '/to-listen', previousPath: '/' },
  { pattern: '/customize', previousPath: '/' },
]

function resolvePreviousPath(pathname: string): string | null {
  for (const route of BACK_ROUTES) {
    const match = matchPath({ path: route.pattern, end: true }, pathname)
    if (match) return generatePath(route.previousPath, match.params)
  }
  return null
}

const NAV_LINKS = [
  { label: 'Reviews', path: '/reviews' },
  { label: 'Search', path: '/search' },
  { label: 'Stats', path: '/stats' },
  { label: 'Friends', path: '/friends' },
  { label: 'To-Listen', path: '/to-listen' },
]

function NavBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthSession()

  const previousPath = resolvePreviousPath(location.pathname)

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <nav className="app-nav">
      {previousPath ? (
        <button type="button" className="vco-tbtn" onClick={() => navigate(previousPath)}>
          ⟨ Back
        </button>
      ) : (
        <span className="app-nav-brand">Music Organizer</span>
      )}

      {user && (
        <div className="app-nav-links">
          {NAV_LINKS.map(({ label, path }) => (
            <button
              key={path}
              type="button"
              className={`app-nav-link${isActive(path) ? ' active' : ''}`}
              onClick={() => navigate(path)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1 }} />
      <AccountMenu />
    </nav>
  )
}

export default NavBar
