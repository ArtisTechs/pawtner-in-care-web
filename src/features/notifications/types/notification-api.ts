export type NotificationType = 'ADOPTION' | 'CHAT' | 'SYSTEM' | (string & {})

export type NotificationReferenceType =
  | 'ADOPTION_REQUEST'
  | 'CHAT_CONVERSATION'
  | 'SUPPORT_CONVERSATION'
  | 'PET'
  | 'OTHER'
  | (string & {})

export interface NotificationItem {
  id: string
  title: string
  message: string
  type: NotificationType
  referenceType: NotificationReferenceType
  referenceId: string | null
  isRead: boolean
  createdByUserId: string | null
  createdAt: string
  updatedAt: string
}

export interface NotificationListQuery {
  ignorePagination?: boolean
  isRead?: boolean
  page?: number
  size?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  type?: string
}

export interface PaginatedNotificationsResponse {
  content: NotificationItem[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface NotificationUnreadSummary {
  unreadCount: number
}
