import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// A tab left open keeps running the version it loaded. Check for a new deploy
// periodically and whenever the tab comes back into view; with autoUpdate the
// page reloads onto the new version once it is installed (edits are already saved).
const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    const check = () => {
      if (registration.installing || !navigator.onLine) return
      registration.update().catch(() => {})
    }
    setInterval(check, UPDATE_CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
