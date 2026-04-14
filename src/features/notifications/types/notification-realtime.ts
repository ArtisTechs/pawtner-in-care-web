import type { NotificationItem } from '@/features/notifications/types/notification-api'

export type NotificationRealtimeEventType =
  | 'NOTIFICATION_CREATED'
  | 'NOTIFICATION_UPDATED'
  | 'NOTIFICATION_DELETED'
  | 'NOTIFICATION_READ_ALL'

export interface NotificationRealtimeEvent {
  eventType: NotificationRealtimeEventType
  notification: NotificationItem | null
  notificationId: string | null
  unreadCount: number | null
}
