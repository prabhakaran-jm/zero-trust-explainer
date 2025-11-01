import { useEffect, useState } from 'react'

/**
 * Health chip component that checks API health
 */
function HealthChip({ apiBase }) {
  const [state, setState] = useState('loading') // 'ok' | 'bad' | 'loading'

  useEffect(() => {
    let cancelled = false

    fetch(`${apiBase}/health`, { method: 'GET' })
      .then(r => (r.ok ? 'ok' : 'bad'))
      .catch(() => 'bad')
      .then(s => {
        if (!cancelled) setState(s)
      })

    return () => {
      cancelled = true
    }
  }, [apiBase])

  const color = state === 'ok' ? '#22c55e' : state === 'bad' ? '#ef4444' : '#94a3b8'
  const label = state === 'ok' ? 'API OK' : state === 'bad' ? 'API Error' : 'Checking…'

  return (
    <span
      style={{
        fontSize: 12,
        padding: '4px 8px',
        borderRadius: 999,
        background: color,
        color: '#fff'
      }}
      aria-live="polite"
    >
      {label}
    </span>
  )
}

export default HealthChip

