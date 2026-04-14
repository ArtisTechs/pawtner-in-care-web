import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { chatRealtimeService } from '@/features/chat/services/chat-realtime.service'
import { notificationService } from '@/features/notifications/services/notification.service'
import { NotificationContext } from '@/features/notifications/providers/notification-context'

interface NotificationProviderProps extends PropsWithChildren {
  session?: AuthSession | null
}

function NotificationProvider({ children, session }: NotificationProviderProps) {
  const [unreadCount, setUnreadCount] = useState(0)
  const latestAccessTokenRef = useRef('')
  const accessToken = session?.accessToken?.trim() ?? ''

  const refreshUnreadCount = useCallback(async () => {
    const token = latestAccessTokenRef.current

    if (!token) {
      await Promise.resolve()

      if (!latestAccessTokenRef.current) {
        setUnreadCount(0)
      }
      return
    }

    try {
      const summary = await notificationService.getUnreadCount(token)
      if (token !== latestAccessTokenRef.current) {
        return
      }

      setUnreadCount(summary.unreadCount)
    } catch {
      // Keep the current value and wait for the next successful refresh.
    }
  }, [])

  useEffect(() => {
    latestAccessTokenRef.current = accessToken
  }, [accessToken])

  useEffect(() => {
    if (!accessToken) {
      const timeoutId = window.setTimeout(() => {
        setUnreadCount(0)
      }, 0)

      return () => {
        window.clearTimeout(timeoutId)
      }
    }

    const token = accessToken

    void notificationService
      .getUnreadCount(token)
      .then((summary) => {
        if (token !== latestAccessTokenRef.current) {
          return
        }

        setUnreadCount(summary.unreadCount)
      })
      .catch(() => {
        // Keep the current value and wait for the next successful refresh.
      })
  }, [accessToken])

  useEffect(() => {
    if (!accessToken) {
      return
    }

    const unsubscribe = chatRealtimeService.subscribeNotification((event) => {
      if (event.unreadCount !== null) {
        setUnreadCount(event.unreadCount)
        return
      }

      void refreshUnreadCount()
    })

    return unsubscribe
  }, [accessToken, refreshUnreadCount])

  const value = useMemo(
    () => ({
      refreshUnreadCount,
      unreadCount,
    }),
    [refreshUnreadCount, unreadCount],
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export default NotificationProvider
