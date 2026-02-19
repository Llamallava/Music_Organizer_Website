import { Navigate, Route, Routes } from 'react-router-dom'
import AccountMenu from './components/AccountMenu'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import AddAlbumPage from './pages/AddAlbumPage'
import AlbumReviewPage from './pages/AlbumReviewPage'
import AuthPage from './pages/AuthPage'
import FriendAlbumReviewPage from './pages/FriendAlbumReviewPage'
import FriendDetailPage from './pages/FriendDetailPage'
import FriendsPage from './pages/FriendsPage'
import FriendReviewsPage from './pages/FriendReviewsPage'
import ExplorePage from './pages/ExplorePage'
import MyStatsPage from './pages/MyStatsPage'
import MyStuffPage from './pages/MyStuffPage'
import ReviewsPage from './pages/ReviewsPage'
import SearchPage from './pages/SearchPage'
import ToListenPage from './pages/ToListenPage'
import PlaylistsPage from './pages/PlaylistsPage'

function App() {
  return (
    <>
      <AccountMenu />
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
        <Route
          path="/playlists"
          element={
            <ProtectedRoute>
              <PlaylistsPage />
            </ProtectedRoute>
          }
        />
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
    </>
  )
}

export default App
