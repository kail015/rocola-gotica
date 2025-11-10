import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Display from './Display.jsx'
import AdminAccess from './AdminAccess.jsx'
import VideoScreen from './VideoScreen.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/admin-access" element={<AdminAccess />} />
        <Route path="/display" element={<Display />} />
        <Route path="/video" element={<VideoScreen />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
