import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { SettingsProvider } from './contexts/SettingsContext'
import './styles/global.css'

const root = createRoot(document.getElementById('root')!)
root.render(
  <SettingsProvider>
    <App />
  </SettingsProvider>
)
