import { generatePath, matchPath, useLocation, useNavigate } from 'react-router-dom'

type LinearBackRoute = {
  pattern: string
  previousPath: string
}

const LINEAR_BACK_ROUTES: LinearBackRoute[] = [
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
]

const resolvePreviousPath = (pathname: string) => {
  for (const route of LINEAR_BACK_ROUTES) {
    const match = matchPath({ path: route.pattern, end: true }, pathname)
    if (match) {
      return generatePath(route.previousPath, match.params)
    }
  }

  return '/'
}

type LinearBackButtonProps = {
  className?: string
  label?: string
  variant?: 'default' | 'console'
}

function LinearBackButton({ className, label = 'Back', variant = 'default' }: LinearBackButtonProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const previousPath = resolvePreviousPath(pathname)

  if (variant === 'console') {
    return (
      <button
        type="button"
        onClick={() => navigate(previousPath)}
        className={['vco-tbtn', className].filter(Boolean).join(' ')}
      >
        ⟨ {label}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => navigate(previousPath)}
      className={['rounded-lg bg-surface-2 px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-3', className]
        .filter(Boolean)
        .join(' ')}
    >
      {label}
    </button>
  )
}

export default LinearBackButton
