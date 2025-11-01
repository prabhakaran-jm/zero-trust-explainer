import { useEffect, useRef } from 'react'

/**
 * Polling hook for auto-refresh
 * @param {Function} fn - Function to call on each poll
 * @param {number} intervalMs - Polling interval in milliseconds
 * @param {boolean} enabled - Whether polling is enabled
 */
export default function usePolling(fn, intervalMs, enabled) {
  const timer = useRef(null)
  const fnRef = useRef(fn)

  // Keep fnRef up to date
  useEffect(() => {
    fnRef.current = fn
  }, [fn])

  useEffect(() => {
    if (!enabled) {
      if (timer.current) {
        clearInterval(timer.current)
        timer.current = null
      }
      return
    }

    // Initial fetch
    fnRef.current()

    // Set up interval
    timer.current = setInterval(() => {
      fnRef.current()
    }, intervalMs)

    return () => {
      if (timer.current) {
        clearInterval(timer.current)
        timer.current = null
      }
    }
  }, [intervalMs, enabled]) // Removed fn from dependencies to avoid restarting on every render
}

