import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// One-time migration: rescue customized data from previous store versions
;(function migrateStore() {
  const CURRENT = 'cheddar-store-v3'
  const PREV_KEYS = ['cheddar-store-v2', 'cheddar-store-v1']
  try {
    const currentRaw = localStorage.getItem(CURRENT)
    if (!currentRaw) return
    const current = JSON.parse(currentRaw)
    for (const key of PREV_KEYS) {
      const prevRaw = localStorage.getItem(key)
      if (!prevRaw) continue
      const prev = JSON.parse(prevRaw)
      if (prev.state?.quickLinks) {
        current.state.quickLinks = prev.state.quickLinks
      }
      if (prev.state?.anthropicApiKey) {
        current.state.anthropicApiKey = prev.state.anthropicApiKey
      }
      localStorage.setItem(CURRENT, JSON.stringify(current))
      localStorage.removeItem(key)
      break
    }
  } catch {}
})()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
