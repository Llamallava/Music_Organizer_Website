import { matchPath, useLocation, useNavigate } from 'react-router-dom'

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
  { pattern: '/search', previousPath: '/' },
  { pattern: '/friends', previousPath: '/' },
]

const resolvePreviousPath = (pathname: string) =>
  LINEAR_BACK_ROUTES.find((route) => matchPath({ path: route.pattern, end: true }, pathname))
    ?.previousPath ?? '/'

type LinearBackButtonProps = {
  className?: string
  label?: string
}

function LinearBackButton({ className, label = 'Back' }: LinearBackButtonProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const previousPath = resolvePreviousPath(pathname)

  return (
    <button
      type="button"
      onClick={() => navigate(previousPath)}
      className={['rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-900', className]
        .filter(Boolean)
        .join(' ')}
    >
      {label}
    </button>
  )
}

export default LinearBackButton
