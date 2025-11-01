import toast from 'react-hot-toast'

/**
 * Toast notification helper
 */
export const notify = {
  ok: (msg) => toast.success(msg, { duration: 3000 }),
  err: (msg) => toast.error(msg, { duration: 5000 }),
  info: (msg) => toast(msg, { duration: 2500 })
}

