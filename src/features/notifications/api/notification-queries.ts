import type { NotificationListQuery } from '@/features/notifications/types/notification-api'

const appendIfPresent = (
  params: URLSearchParams,
  key: string,
  value: boolean | number | string | undefined,
) => {
  if (value === undefined || value === null) {
    return
  }

  if (typeof value === 'string') {
    const normalized = value.trim()
    if (!normalized) {
      return
    }

    params.set(key, normalized)
    return
  }

  params.set(key, String(value))
}

export const buildNotificationListQueryString = (query?: NotificationListQuery) => {
  if (!query) {
    return ''
  }

  const params = new URLSearchParams()
  appendIfPresent(params, 'isRead', query.isRead)
  appendIfPresent(params, 'type', query.type)
  appendIfPresent(params, 'page', query.page)
  appendIfPresent(params, 'size', query.size)
  appendIfPresent(params, 'sortBy', query.sortBy)
  appendIfPresent(params, 'sortDir', query.sortDir)
  appendIfPresent(params, 'ignorePagination', query.ignorePagination)

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}
