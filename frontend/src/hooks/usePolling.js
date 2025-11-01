import { useEffect, useRef } from 'react'

/**
 * Robust polling hook for auto-refresh
 * @param {Function} fn - Function to call on each poll
 * @param {number} intervalMs - Polling interval in milliseconds
 * @param {boolean} enabled - Whether polling is enabled
 */
export default function usePolling(fn, intervalMs, enabled) {
  const intervalRef = useRef(null)
  const timeoutRef = useRef(null)
  const savedCallback = useRef(fn)

  // Update callback ref whenever fn changes
  useEffect(() => {
    savedCallback.current = fn
  }, [fn])

  useEffect(() => {
    // Cleanup function
    const cleanup = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    if (!enabled) {
      console.log('[usePolling] Polling disabled, cleaning up...')
      cleanup()
      return
    }

    console.log('[usePolling] Starting polling with interval:', intervalMs, 'ms')

    // Call immediately on enable (no delay)
    console.log('[usePolling] Calling function immediately')
    savedCallback.current()

    // Set up interval for subsequent calls
    intervalRef.current = setInterval(() => {
      console.log('[usePolling] Interval tick - calling function')
      savedCallback.current()
    }, intervalMs)

    // Return cleanup function
    return () => {
      console.log('[usePolling] Cleaning up polling on unmount/re-run')
      cleanup()
    }
  }, [intervalMs, enabled])
}

