import { createContext } from 'react'

interface NotificationContextValue {
  unreadCount: number
  refreshUnreadCount: () => Promise<void>
}

export const NotificationContext = createContext<NotificationContextValue>({
  refreshUnreadCount: async () => {
    return Promise.resolve()
  },
  unreadCount: 0,
})
