import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack ?? '',
    }
  }

  return {
    message: String(error),
    stack: '',
  }
}

// Debug: capture React render errors
const rootEl = document.getElementById('root')!
window.addEventListener('error', (e) => {
  rootEl.innerHTML = `<div style="padding:20px;color:#fff;background:#000;font-family:monospace;white-space:pre-wrap;word-break:break-all;"><h2 style="color:#f44">Runtime Error</h2><p>${e.message}</p><p style="color:#888;font-size:12px">${e.error?.stack || ''}</p></div>`
})
window.addEventListener('unhandledrejection', (e) => {
  const details = getErrorDetails(e.reason)
  rootEl.innerHTML = `<div style="padding:20px;color:#fff;background:#000;font-family:monospace;white-space:pre-wrap;word-break:break-all;"><h2 style="color:#f44">Unhandled Promise Rejection</h2><p>${details.message}</p><p style="color:#888;font-size:12px">${details.stack}</p></div>`
})

try {
  createRoot(rootEl).render(
    <HashRouter>
      <App />
    </HashRouter>
  )
} catch (err: unknown) {
  const details = getErrorDetails(err)
  rootEl.innerHTML = `<div style="padding:20px;color:#fff;background:#000;font-family:monospace;white-space:pre-wrap;word-break:break-all;"><h2 style="color:#f44">Render Error</h2><p>${details.message}</p><p style="color:#888;font-size:12px">${details.stack}</p></div>`
}
