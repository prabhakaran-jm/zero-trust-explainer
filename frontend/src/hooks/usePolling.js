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

    console.log('Polling started: interval', intervalMs, 'ms')
    
    // Initial fetch (with small delay to let state settle)
    const initialTimeout = setTimeout(() => {
    fnRef.current()
    }, 500)

    // Set up interval
    timer.current = setInterval(() => {
      console.log('Polling: calling fetch function')
      fnRef.current()
    }, intervalMs)

    return () => {
      clearTimeout(initialTimeout)
      if (timer.current) {
        clearInterval(timer.current)
        timer.current = null
      }
    }
  }, [intervalMs, enabled]) // Removed fn from dependencies to avoid restarting on every render
}

