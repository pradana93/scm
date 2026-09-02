import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import { SetupProvider } from '@/lib/SetupContext'
import '@/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SetupProvider>
      <App />
    </SetupProvider>
  </React.StrictMode>
)
