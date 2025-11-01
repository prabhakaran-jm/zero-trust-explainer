import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster 
        position="top-right" 
        toastOptions={{ 
          aria: { 
            role: 'status', 
            'aria-live': 'polite' 
          } 
        }} 
      />
    </ErrorBoundary>
  </React.StrictMode>,
)
