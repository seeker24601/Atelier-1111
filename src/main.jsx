import React from 'react'
import { createRoot } from 'react-dom/client'
// Bundled, not fetched: the app makes no request to anyone but OpenRouter.
import '@fontsource-variable/archivo/wdth.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/controls.css'
import './styles/layout.css'
import './styles/gallery.css'
import './styles/overlays.css'
import App from './App.jsx'

// A file dropped where nothing takes it must not replace the app with that file.
for (const type of ['dragover', 'drop']) window.addEventListener(type, (e) => e.preventDefault())

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
