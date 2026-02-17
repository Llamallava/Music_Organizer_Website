import { Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import AddAlbumPage from './pages/AddAlbumPage'
import AlbumReviewPage from './pages/AlbumReviewPage'
import ReviewsPage from './pages/ReviewsPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/reviews" element={<ReviewsPage />} />
      <Route path="/reviews/add" element={<AddAlbumPage />} />
      <Route path="/reviews/:userSavedAlbumId" element={<AlbumReviewPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
