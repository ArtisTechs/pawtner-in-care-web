import { buildNotificationListQueryString } from '@/features/notifications/api/notification-queries'
import type {
  NotificationItem,
  NotificationListQuery,
  NotificationUnreadSummary,
  PaginatedNotificationsResponse,
} from '@/features/notifications/types/notification-api'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

type MaybePaginatedResponse<T> =
  | T[]
  | {
      content?: T[] | null
      data?: T[] | null
      page?: number | null
      size?: number | null
      totalElements?: number | null
      totalPages?: number | null
    }

type MaybeUnreadSummary =
  | number
  | {
      count?: number | null
      total?: number | null
      totalUnread?: number | null
      totalUnreadCount?: number | null
      unreadCount?: number | null
    }

const inFlightListRequests = new Map<string, Promise<PaginatedNotificationsResponse>>()
const inFlightUnreadCountRequests = new Map<string, Promise<NotificationUnreadSummary>>()

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object'

const toStringValue = (value: unknown) => {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

const toBooleanValue = (value: unknown) => {
  if (typeof value === 'boolean') {
    return value
  }

  return null
}

const toNotificationType = (value: unknown): NotificationItem['type'] => {
  const normalizedType = toStringValue(value).toUpperCase()

  if (
    normalizedType === 'ADOPTION' ||
    normalizedType === 'DONATION_LOG' ||
    normalizedType === 'GIFT_LOG' ||
    normalizedType === 'COMMUNITY_LOG' ||
    normalizedType === 'SOS_LOG' ||
    normalizedType === 'ACHIEVEMENT' ||
    normalizedType === 'TODO' ||
    normalizedType === 'CHAT' ||
    normalizedType === 'SYSTEM'
  ) {
    return normalizedType
  }

  return normalizedType || 'SYSTEM'
}

const toNotificationReferenceType = (value: unknown): NotificationItem['referenceType'] => {
  const normalizedType = toStringValue(value).toUpperCase()

  if (
    normalizedType === 'ADOPTION_REQUEST' ||
    normalizedType === 'DONATION_TRANSACTION' ||
    normalizedType === 'GIFT_ENTRY' ||
    normalizedType === 'COMMUNITY_POST' ||
    normalizedType === 'EMERGENCY_SOS' ||
    normalizedType === 'ACHIEVEMENT' ||
    normalizedType === 'TODO_ITEM' ||
    normalizedType === 'CHAT_CONVERSATION' ||
    normalizedType === 'SUPPORT_CONVERSATION' ||
    normalizedType === 'PET' ||
    normalizedType === 'OTHER'
  ) {
    return normalizedType
  }

  return normalizedType || 'OTHER'
}

const resolveCollection = (value: MaybePaginatedResponse<unknown>) => {
  if (Array.isArray(value)) {
    return value
  }

  if (Array.isArray(value?.content)) {
    return value.content
  }

  if (Array.isArray(value?.data)) {
    return value.data
  }

  return []
}

const normalizeNotification = (value: unknown): NotificationItem | null => {
  if (!isRecord(value)) {
    return null
  }

  const id = toStringValue(value.id)
  if (!id) {
    return null
  }

  const nowIso = new Date().toISOString()

  return {
    createdAt: toStringValue(value.createdAt ?? value.createdDate) || nowIso,
    createdByUserId: toStringValue(value.createdByUserId ?? value.createdBy ?? value.createdById) || null,
    id,
    isRead: Boolean(toBooleanValue(value.isRead) ?? value.read),
    message: toStringValue(value.message ?? value.content ?? value.body),
    referenceId: toStringValue(value.referenceId) || null,
    referenceType: toNotificationReferenceType(value.referenceType),
    title: toStringValue(value.title) || 'Notification',
    type: toNotificationType(value.type),
    updatedAt: toStringValue(value.updatedAt ?? value.updatedDate ?? value.createdAt) || nowIso,
  }
}

const toResolvedPage = (value: number | null | undefined, fallback: number) => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

const normalizePaginatedResponse = (
  value: MaybePaginatedResponse<unknown>,
  fallbackPage = 0,
  fallbackSize = 12,
): PaginatedNotificationsResponse => {
  const content = resolveCollection(value)
    .map((entry) => normalizeNotification(entry))
    .filter((entry): entry is NotificationItem => Boolean(entry))

  if (Array.isArray(value)) {
    return {
      content,
      page: fallbackPage,
      size: fallbackSize,
      totalElements: content.length,
      totalPages: 1,
    }
  }

  const size = Math.max(1, toResolvedPage(value.size, fallbackSize))
  const totalElements = Math.max(0, toResolvedPage(value.totalElements, content.length))

  return {
    content,
    page: Math.max(0, toResolvedPage(value.page, fallbackPage)),
    size,
    totalElements,
    totalPages: Math.max(1, toResolvedPage(value.totalPages, Math.ceil(totalElements / size))),
  }
}

const normalizeUnreadSummary = (value: MaybeUnreadSummary): NotificationUnreadSummary => {
  const candidates =
    typeof value === 'number'
      ? [value]
      : [value.unreadCount, value.totalUnreadCount, value.totalUnread, value.total, value.count]

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return {
        unreadCount: Math.max(0, Math.floor(candidate)),
      }
    }
  }

  return { unreadCount: 0 }
}

const listMyNotifications = (token: string, query?: NotificationListQuery) => {
  const queryString = buildNotificationListQueryString(query)
  const path = `${API_ENDPOINTS.notifications.my}${queryString}`
  const requestKey = `${token}:${path}`
  const cachedRequest = inFlightListRequests.get(requestKey)

  if (cachedRequest) {
    return cachedRequest
  }

  const request = apiClient
    .get<MaybePaginatedResponse<unknown>>(path, { token })
    .then((response) => normalizePaginatedResponse(response, query?.page ?? 0, query?.size ?? 12))

  inFlightListRequests.set(requestKey, request)

  void request.finally(() => {
    inFlightListRequests.delete(requestKey)
  })

  return request
}

const getUnreadCount = (token: string) => {
  const requestKey = token
  const cachedRequest = inFlightUnreadCountRequests.get(requestKey)

  if (cachedRequest) {
    return cachedRequest
  }

  const request = apiClient
    .get<MaybeUnreadSummary>(API_ENDPOINTS.notifications.unreadCount, { token })
    .then(normalizeUnreadSummary)

  inFlightUnreadCountRequests.set(requestKey, request)

  void request.finally(() => {
    inFlightUnreadCountRequests.delete(requestKey)
  })

  return request
}

const getMyNotification = async (notificationId: string, token: string) => {
  const response = await apiClient.get<unknown>(API_ENDPOINTS.notifications.byId(notificationId), { token })
  const notification = normalizeNotification(response)

  if (!notification) {
    throw new Error('Unable to normalize notification from API response.')
  }

  return notification
}

export const notificationService = {
  delete: (notificationId: string, token: string) =>
    apiClient.delete<null>(API_ENDPOINTS.notifications.byId(notificationId), { token }),
  getMyNotification,
  getUnreadCount,
  listMyNotifications,
  markAllAsRead: (token: string) =>
    apiClient.patch<unknown, Record<string, never>>(API_ENDPOINTS.notifications.readAll, {}, { token }),
  markAsRead: (notificationId: string, token: string) =>
    apiClient.patch<unknown, Record<string, never>>(API_ENDPOINTS.notifications.markRead(notificationId), {}, { token }),
  markAsUnread: (notificationId: string, token: string) =>
    apiClient.patch<unknown, Record<string, never>>(API_ENDPOINTS.notifications.markUnread(notificationId), {}, { token }),
}
