import { useEffect, useRef } from 'react'

/**
 * Polling hook for auto-refresh
 * @param {Function} fn - Function to call on each poll
 * @param {number} intervalMs - Polling interval in milliseconds
 * @param {boolean} enabled - Whether polling is enabled
 */
export default function usePolling(fn, intervalMs, enabled) {
  const timer = useRef(null)

  useEffect(() => {
    if (!enabled) return

    fn() // initial fetch

    timer.current = setInterval(fn, intervalMs)

    return () => {
      if (timer.current) {
        clearInterval(timer.current)
      }
    }
  }, [fn, intervalMs, enabled])
}

