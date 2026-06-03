import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import NavBar from './components/NavBar'
import ProtectedRoute from './components/ProtectedRoute'
import EtherealBackground from './components/EtherealBackground'
import Starfield from './components/Starfield'

const PAGE_SEEDS: [string, number][] = [
  ['/friends/:id/reviews/:albumId', 65790],
  ['/friends/:id/reviews',          54689],
  ['/friends/:id/stats',            76801],
  ['/friends/:id',                  43578],
  ['/reviews/add',                  61893],
  ['/reviews/:id',                  74912],
  ['/artists/:name',                10245],
  ['/friends',                      32467],
  ['/artists',                      96134],
  ['/stats',                        85023],
  ['/auth',                         42561],
  ['/search',                       21356],
  ['/explore',                      87912],
  ['/customize',                    99023],
  ['/my-stuff',                     11134],
  ['/to-listen',                    22245],
  ['/',                             31337],
]

function matchPattern(pathname: string, pattern: string): boolean {
  const a = pathname.split('/').filter(Boolean)
  const b = pattern.split('/').filter(Boolean)
  return a.length === b.length && b.every((seg, i) => seg.startsWith(':') || seg === a[i])
}

function seedForPath(pathname: string): number {
  for (const [pattern, seed] of PAGE_SEEDS) {
    if (matchPattern(pathname, pattern)) return seed
  }
  return 20251
}
import HomePage from './pages/HomePage'
import AddAlbumPage from './pages/AddAlbumPage'
import AlbumReviewPage from './pages/AlbumReviewPage'
import AuthPage from './pages/AuthPage'
import FriendAlbumReviewPage from './pages/FriendAlbumReviewPage'
import FriendDetailPage from './pages/FriendDetailPage'
import FriendsPage from './pages/FriendsPage'
import FriendReviewsPage from './pages/FriendReviewsPage'
import ExplorePage from './pages/ExplorePage'
import ArtistDetailPage from './pages/ArtistDetailPage'
import ArtistsPage from './pages/ArtistsPage'
import MyStatsPage from './pages/MyStatsPage'
import MyStuffPage from './pages/MyStuffPage'
import CustomizePage from './pages/CustomizePage'
import { BackgroundProvider } from './contexts/BackgroundContext'
import ReviewsPage from './pages/ReviewsPage'
import SearchPage from './pages/SearchPage'
import ToListenPage from './pages/ToListenPage'
// import PlaylistsPage from './pages/PlaylistsPage'

function App() {
  const { pathname } = useLocation()
  const starSeed = seedForPath(pathname)

  return (
    <BackgroundProvider>
      <EtherealBackground />
      <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: -3, pointerEvents: 'none' }}>
        <Starfield opacity={0.55} seed={starSeed} />
      </div>
      <NavBar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/explore"
          element={
            <ProtectedRoute>
              <ExplorePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customize"
          element={
            <ProtectedRoute>
              <CustomizePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-stuff"
          element={
            <ProtectedRoute>
              <MyStuffPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/to-listen"
          element={
            <ProtectedRoute>
              <ToListenPage />
            </ProtectedRoute>
          }
        />
        {/* <Route
          path="/playlists"
          element={
            <ProtectedRoute>
              <PlaylistsPage />
            </ProtectedRoute>
          }
        /> */}
        <Route
          path="/reviews"
          element={
            <ProtectedRoute>
              <ReviewsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reviews/add"
          element={
            <ProtectedRoute>
              <AddAlbumPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reviews/:userSavedAlbumId"
          element={
            <ProtectedRoute>
              <AlbumReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/stats"
          element={
            <ProtectedRoute>
              <MyStatsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/artists"
          element={
            <ProtectedRoute>
              <ArtistsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/artists/:artistName"
          element={
            <ProtectedRoute>
              <ArtistDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/search"
          element={
            <ProtectedRoute>
              <SearchPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/friends"
          element={
            <ProtectedRoute>
              <FriendsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/friends/:friendUserId"
          element={
            <ProtectedRoute>
              <FriendDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/friends/:friendUserId/reviews"
          element={
            <ProtectedRoute>
              <FriendReviewsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/friends/:friendUserId/reviews/:userSavedAlbumId"
          element={
            <ProtectedRoute>
              <FriendAlbumReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/friends/:friendUserId/stats"
          element={
            <ProtectedRoute>
              <MyStatsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BackgroundProvider>
  )
}

export default App
