import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import AddAlbumPage from './pages/AddAlbumPage'
import AlbumReviewPage from './pages/AlbumReviewPage'
import AuthPage from './pages/AuthPage'
import MyStatsPage from './pages/MyStatsPage'
import ReviewsPage from './pages/ReviewsPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/auth" element={<AuthPage />} />
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
