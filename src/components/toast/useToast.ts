import { useCallback, useEffect, useRef, useState } from 'react'
import type { ToastState, ToastVariant } from './Toast'

const DEFAULT_TOAST_DURATION_MS = 4200

type ShowToastOptions = {
  durationMs?: number
  variant?: ToastVariant
}

export const useToast = () => {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timeoutRef = useRef<number | null>(null)

  const clearToast = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    setToast(null)
  }, [])

  const showToast = useCallback(
    (message: string, options?: ShowToastOptions) => {
      clearToast()

      setToast({
        message,
        variant: options?.variant ?? 'info',
      })

      const durationMs = options?.durationMs ?? DEFAULT_TOAST_DURATION_MS
      if (durationMs > 0) {
        timeoutRef.current = window.setTimeout(() => {
          setToast(null)
          timeoutRef.current = null
        }, durationMs)
      }
    },
    [clearToast],
  )

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    clearToast,
    showToast,
    toast,
  }
}
