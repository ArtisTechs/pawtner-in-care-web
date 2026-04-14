import type { ConversationListQuery, MessageListQuery } from '@/features/chat/types/chat-api'

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

export const buildConversationListQueryString = (query?: ConversationListQuery) => {
  if (!query) {
    return ''
  }

  const params = new URLSearchParams()
  appendIfPresent(params, 'page', query.page)
  appendIfPresent(params, 'size', query.size)
  appendIfPresent(params, 'search', query.search)
  appendIfPresent(params, 'status', query.status)

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}

export const buildMessageListQueryString = (query?: MessageListQuery) => {
  if (!query) {
    return ''
  }

  const params = new URLSearchParams()
  appendIfPresent(params, 'page', query.page)
  appendIfPresent(params, 'size', query.size)
  appendIfPresent(params, 'sortDir', query.sortDir)

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}
