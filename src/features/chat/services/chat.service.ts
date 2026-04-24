import type {
  ChatMessage,
  ChatParticipant,
  ConversationDetail,
  ConversationFolder,
  ConversationListQuery,
  ConversationReadState,
  ConversationSummary,
  CreateConversationPayload,
  MessageListQuery,
  MessageReadState,
  PaginatedConversationsResponse,
  PaginatedMessagesResponse,
  SeenReceipt,
  SendMessagePayload,
  UnreadCountSummary,
} from '@/features/chat/types/chat-api'
import { buildConversationListQueryString, buildMessageListQueryString } from '@/features/chat/api/chat-queries'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

type MaybePaginatedResponse<T> =
  | T[]
  | {
      content?: T[] | null
      page?: number | null
      size?: number | null
      totalElements?: number | null
      totalPages?: number | null
    }

type MaybeUnreadSummary = {
  total?: number | null
  totalUnread?: number | null
  totalUnreadCount?: number | null
}

type MaybeCreateConversationResponse =
  | ConversationSummary
  | ConversationDetail
  | {
      conversationId?: string | null
      id?: string | null
    }

interface MessageNormalizationOptions {
  currentUserId?: string
  fallbackConversationId?: string
}

interface BulkDeleteConversationsRequest {
  conversationIds: string[]
}

interface BulkDeleteConversationsResult {
  deletedConversationIds: string[]
  failedConversationIds: string[]
}

const MAX_BULK_DELETE_CONVERSATION_IDS = 100

const inFlightConversationRequests = new Map<string, Promise<PaginatedConversationsResponse>>()
const inFlightMessageRequests = new Map<string, Promise<PaginatedMessagesResponse>>()
const inFlightUnreadRequests = new Map<string, Promise<UnreadCountSummary>>()

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object'

const toStringValue = (value: unknown) => {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

const toNumberValue = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return value
}

const toBooleanValue = (value: unknown) => {
  if (typeof value !== 'boolean') {
    return null
  }

  return value
}

const resolveAttachmentFileNameFromUrl = (url: string) => {
  const normalizedUrl = url.trim()
  if (!normalizedUrl) {
    return ''
  }

  try {
    const parsedUrl = new URL(normalizedUrl)
    const urlPath = parsedUrl.pathname.replace(/\/+$/, '')
    const pathSegment = urlPath.split('/').filter(Boolean).pop() || ''

    try {
      return decodeURIComponent(pathSegment)
    } catch {
      return pathSegment
    }
  } catch {
    const cleanedPath = normalizedUrl.split('?')[0]?.split('#')[0] || normalizedUrl
    return cleanedPath.split('/').filter(Boolean).pop() || ''
  }
}

const toArray = <T>(value: MaybePaginatedResponse<T>) => {
  if (Array.isArray(value)) {
    return value
  }

  return Array.isArray(value?.content) ? value.content : []
}

const toNumber = (value: number | null | undefined, fallback: number) => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

const resolveConversationFolder = (value: unknown): ConversationFolder => {
  const folder = toStringValue(value).toUpperCase()

  if (
    folder === 'INBOX' ||
    folder === 'STARRED' ||
    folder === 'SENT' ||
    folder === 'DRAFT' ||
    folder === 'SPAM' ||
    folder === 'IMPORTANT' ||
    folder === 'BIN'
  ) {
    return folder
  }

  return 'INBOX'
}

const resolveReadState = (value: unknown, unreadCount: number): ConversationReadState => {
  const readState = toStringValue(value).toUpperCase()

  if (readState === 'UNREAD' || readState === 'READ' || readState === 'SEEN') {
    return readState
  }

  if (unreadCount > 0) {
    return 'UNREAD'
  }

  return 'READ'
}

const resolveParticipant = (value: Record<string, unknown>): ChatParticipant => {
  const participantValue = isRecord(value.participant) ? value.participant : null
  const otherParticipantValue = isRecord(value.otherParticipant) ? value.otherParticipant : null

  const firstName = toStringValue(otherParticipantValue?.firstName)
  const lastName = toStringValue(otherParticipantValue?.lastName)
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()

  const id =
    toStringValue(
      participantValue?.id ??
        participantValue?.userId ??
        otherParticipantValue?.id ??
        otherParticipantValue?.userId ??
        value.participantId ??
        value.otherParticipantId,
    ) || 'unknown-user'

  const displayName =
    toStringValue(
      participantValue?.displayName ??
        participantValue?.name ??
        otherParticipantValue?.displayName ??
        otherParticipantValue?.name ??
        value.participantName,
    ) ||
    fullName ||
    'User'

  const avatarUrl =
    toStringValue(
      participantValue?.avatarUrl ??
        participantValue?.profilePicture ??
        otherParticipantValue?.avatarUrl ??
        otherParticipantValue?.profilePicture,
    ) || null

  return {
    avatarUrl,
    displayName,
    id,
  }
}

const normalizeConversation = (value: unknown): ConversationSummary | null => {
  if (!isRecord(value)) {
    return null
  }

  const id = toStringValue(value.id ?? value.conversationId)
  if (!id) {
    return null
  }

  const unreadCountValue = toNumberValue(value.unreadCount ?? value.unreadMessages)
  const unreadCount = unreadCountValue ? Math.max(0, Math.floor(unreadCountValue)) : 0

  const lastMessageValue = isRecord(value.lastMessage) ? value.lastMessage : null
  const lastMessageAt =
    toStringValue(value.lastMessageAt ?? lastMessageValue?.createdAt ?? value.updatedAt ?? value.createdAt) || null
  const lastMessagePreview =
    toStringValue(
      value.lastMessagePreview ??
        value.preview ??
        value.contentPreview ??
        lastMessageValue?.content ??
        lastMessageValue?.body ??
        lastMessageValue?.text ??
        lastMessageValue?.contentPreview ??
        value.lastMessage,
    ) || null

  return {
    folder: resolveConversationFolder(value.folder),
    id,
    isImportant: Boolean(value.isImportant),
    isStarred: Boolean(value.isStarred ?? value.starred),
    lastMessageAt,
    lastMessagePreview,
    lastMessageSeenAt: toStringValue(value.lastMessageSeenAt) || null,
    participant: resolveParticipant(value),
    readState: resolveReadState(value.readState, unreadCount),
    unreadCount,
    updatedAt: toStringValue(value.updatedAt ?? value.lastMessageAt ?? value.createdAt) || null,
  }
}

const normalizeConversationDetail = (value: unknown): ConversationDetail | null => {
  const summary = normalizeConversation(value)
  if (!summary || !isRecord(value)) {
    return null
  }

  const permissionsValue = isRecord(value.permissions) ? value.permissions : null
  const canSend = toBooleanValue(permissionsValue?.canSend)
  const canView = toBooleanValue(permissionsValue?.canView)

  return {
    ...summary,
    permissions:
      canSend === null && canView === null
        ? undefined
        : {
            canSend: canSend ?? true,
            canView: canView ?? true,
          },
  }
}

const resolveMessageReadState = (
  value: unknown,
  direction: 'INCOMING' | 'OUTGOING',
  seen: boolean,
): MessageReadState => {
  const readState = toStringValue(value).toUpperCase()

  if (readState === 'SENT' || readState === 'DELIVERED' || readState === 'READ' || readState === 'SEEN') {
    return readState
  }

  if (direction === 'OUTGOING') {
    return seen ? 'SEEN' : 'SENT'
  }

  return seen ? 'SEEN' : 'READ'
}

const normalizeMessage = (value: unknown, options?: MessageNormalizationOptions): ChatMessage | null => {
  if (!isRecord(value)) {
    return null
  }

  const messageId = toStringValue(value.id ?? value.messageId)
  if (!messageId) {
    return null
  }

  const conversationId = toStringValue(value.conversationId ?? options?.fallbackConversationId)
  if (!conversationId) {
    return null
  }

  const senderValue = isRecord(value.sender) ? value.sender : null
  const senderId = toStringValue(senderValue?.id ?? senderValue?.userId ?? value.senderId) || 'unknown-user'
  const recipientId = toStringValue(value.recipientId)
  const currentUserId = toStringValue(options?.currentUserId)

  let direction: 'INCOMING' | 'OUTGOING' = 'INCOMING'
  const directionValue = toStringValue(value.direction).toUpperCase()
  if (directionValue === 'INCOMING' || directionValue === 'OUTGOING') {
    direction = directionValue
  } else if (currentUserId && senderId === currentUserId) {
    direction = 'OUTGOING'
  } else if (currentUserId && recipientId === currentUserId) {
    direction = 'INCOMING'
  }

  const seen = Boolean(toBooleanValue(value.seen) || toStringValue(value.seenAt))
  const firstName = toStringValue(senderValue?.firstName)
  const lastName = toStringValue(senderValue?.lastName)
  const senderFullName = [firstName, lastName].filter(Boolean).join(' ').trim()
  const displayName =
    toStringValue(senderValue?.displayName ?? senderValue?.name ?? value.senderName) ||
    senderFullName ||
    (direction === 'OUTGOING' ? 'You' : 'User')

  const attachmentValue = isRecord(value.attachment) ? value.attachment : null
  const attachmentUrl =
    toStringValue(
      attachmentValue?.url ??
        value.attachmentUrl ??
        value.fileUrl ??
        value.mediaUrl ??
        value.imageUrl,
    ) || null
  const attachmentName =
    toStringValue(attachmentValue?.name ?? value.attachmentName ?? value.fileName ?? value.mediaName) ||
    (attachmentUrl ? resolveAttachmentFileNameFromUrl(attachmentUrl) : '')
  const resolvedAttachmentName = attachmentName || (attachmentUrl ? 'Attachment' : '')

  return {
    attachment: resolvedAttachmentName || attachmentUrl
      ? {
          mimeType: toStringValue(attachmentValue?.mimeType ?? value.attachmentMimeType) || null,
          name: resolvedAttachmentName,
          size: toNumberValue(attachmentValue?.size ?? value.attachmentSize),
          url: attachmentUrl,
        }
      : null,
    body: toStringValue(
      value.body ?? value.content ?? value.text ?? value.contentPreview ?? value.preview ?? value.lastMessagePreview,
    ) || null,
    conversationId,
    createdAt:
      toStringValue(value.createdAt ?? value.sentAt ?? value.timestamp ?? value.updatedAt) ||
      new Date().toISOString(),
    direction,
    id: messageId,
    readState: resolveMessageReadState(value.readState, direction, seen),
    seenAt: toStringValue(value.seenAt) || null,
    sender: {
      avatarUrl: toStringValue(senderValue?.avatarUrl ?? senderValue?.profilePicture) || null,
      displayName,
      id: senderId,
    },
  }
}

const dedupeMessagesById = (messages: ChatMessage[]) => {
  const seenMessageIds = new Set<string>()

  return messages.filter((message) => {
    if (!message.id) {
      return true
    }

    if (seenMessageIds.has(message.id)) {
      return false
    }

    seenMessageIds.add(message.id)
    return true
  })
}

const normalizeConversationsResponse = (
  value: MaybePaginatedResponse<unknown>,
  fallbackPage = 0,
  fallbackSize = 12,
): PaginatedConversationsResponse => {
  const content = toArray(value)
    .map((conversation) => normalizeConversation(conversation))
    .filter((conversation): conversation is ConversationSummary => Boolean(conversation))

  if (!Array.isArray(value)) {
    const totalElements = toNumber(value.totalElements, content.length)
    const size = Math.max(1, toNumber(value.size, fallbackSize))
    const totalPages = Math.max(1, toNumber(value.totalPages, Math.ceil(totalElements / size)))

    return {
      content,
      page: toNumber(value.page, fallbackPage),
      size,
      totalElements,
      totalPages,
    }
  }

  return {
    content,
    page: fallbackPage,
    size: fallbackSize,
    totalElements: content.length,
    totalPages: 1,
  }
}

const normalizeMessagesResponse = (
  value: MaybePaginatedResponse<unknown>,
  fallbackPage = 0,
  fallbackSize = 30,
  options?: MessageNormalizationOptions,
): PaginatedMessagesResponse => {
  const normalizedMessages = toArray(value)
    .map((message) => normalizeMessage(message, options))
    .filter((message): message is ChatMessage => Boolean(message))
  const content = dedupeMessagesById(normalizedMessages)

  if (!Array.isArray(value)) {
    const totalElements = toNumber(value.totalElements, content.length)
    const size = Math.max(1, toNumber(value.size, fallbackSize))
    const totalPages = Math.max(1, toNumber(value.totalPages, Math.ceil(totalElements / size)))

    return {
      content,
      page: toNumber(value.page, fallbackPage),
      size,
      totalElements,
      totalPages,
    }
  }

  return {
    content,
    page: fallbackPage,
    size: fallbackSize,
    totalElements: content.length,
    totalPages: 1,
  }
}

const normalizeUnreadCountSummary = (value: MaybeUnreadSummary | null | undefined): UnreadCountSummary => {
  const candidates = [value?.totalUnreadCount, value?.totalUnread, value?.total]

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return {
        totalUnreadCount: Math.max(0, Math.floor(candidate)),
      }
    }
  }

  return { totalUnreadCount: 0 }
}

const resolveConversationId = (value: MaybeCreateConversationResponse | null | undefined) => {
  if (!value || typeof value !== 'object') {
    return ''
  }

  const candidates: unknown[] = []

  if ('id' in value) {
    candidates.push(value.id)
  }

  if ('conversationId' in value) {
    candidates.push(value.conversationId)
  }

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }

  return ''
}

const normalizeConversationIds = (conversationIds: string[]) => {
  const nextConversationIds = conversationIds
    .map((conversationId) => conversationId.trim())
    .filter(Boolean)

  return Array.from(new Set(nextConversationIds))
}

const toConversationIdChunks = (conversationIds: string[], chunkSize: number) => {
  const chunks: string[][] = []

  for (let index = 0; index < conversationIds.length; index += chunkSize) {
    chunks.push(conversationIds.slice(index, index + chunkSize))
  }

  return chunks
}

const listConversations = (token: string, query?: ConversationListQuery) => {
  const queryString = buildConversationListQueryString(query)
  const requestKey = `${token}:${queryString}`
  const cachedRequest = inFlightConversationRequests.get(requestKey)

  if (cachedRequest) {
    return cachedRequest
  }

  const request = apiClient
    .get<MaybePaginatedResponse<unknown>>(`${API_ENDPOINTS.chat.conversations}${queryString}`, {
      token,
    })
    .then((response) => normalizeConversationsResponse(response, query?.page ?? 0, query?.size ?? 12))

  inFlightConversationRequests.set(requestKey, request)

  void request.finally(() => {
    inFlightConversationRequests.delete(requestKey)
  })

  return request
}

const listMessages = (
  conversationId: string,
  token: string,
  query?: MessageListQuery,
  options?: MessageNormalizationOptions,
) => {
  const queryString = buildMessageListQueryString({
    sortDir: 'desc',
    ...query,
  })
  const currentUserId = options?.currentUserId?.trim() ?? ''
  const requestKey = `${token}:${currentUserId}:${conversationId}:${queryString}`
  const cachedRequest = inFlightMessageRequests.get(requestKey)

  if (cachedRequest) {
    return cachedRequest
  }

  const request = apiClient
    .get<MaybePaginatedResponse<unknown>>(`${API_ENDPOINTS.chat.messages(conversationId)}${queryString}`, {
      token,
    })
    .then((response) =>
      normalizeMessagesResponse(response, query?.page ?? 0, query?.size ?? 30, {
        ...options,
        fallbackConversationId: conversationId,
      }),
    )

  inFlightMessageRequests.set(requestKey, request)

  void request.finally(() => {
    inFlightMessageRequests.delete(requestKey)
  })

  return request
}

const getUnreadCount = (token: string) => {
  const requestKey = token
  const cachedRequest = inFlightUnreadRequests.get(requestKey)

  if (cachedRequest) {
    return cachedRequest
  }

  const request = apiClient
    .get<MaybeUnreadSummary>(API_ENDPOINTS.chat.unreadCount, { token })
    .then((response) => normalizeUnreadCountSummary(response))

  inFlightUnreadRequests.set(requestKey, request)

  void request.finally(() => {
    inFlightUnreadRequests.delete(requestKey)
  })

  return request
}

const createConversation = async (recipientUserId: string, token: string) => {
  const normalizedRecipientUserId = recipientUserId.trim()

  if (!normalizedRecipientUserId) {
    throw new Error('A recipient user is required to create a conversation.')
  }

  const response = await apiClient.post<MaybeCreateConversationResponse, CreateConversationPayload>(
    API_ENDPOINTS.chat.privateConversation,
    {
      recipientUserId: normalizedRecipientUserId,
      // Backward compatible payload for older backend contracts.
      participantId: normalizedRecipientUserId,
    },
    { token },
  )

  const conversationId = resolveConversationId(response)
  if (!conversationId) {
    throw new Error('Unable to resolve conversation id from the API response.')
  }

  const detailResponse = await apiClient.get<unknown>(API_ENDPOINTS.chat.byId(conversationId), { token })
  const detail = normalizeConversationDetail(detailResponse)

  if (!detail) {
    throw new Error('Unable to normalize conversation detail from the API response.')
  }

  return detail
}

export const chatService = {
  bulkDeleteConversations: async (
    conversationIds: string[],
    token: string,
  ): Promise<BulkDeleteConversationsResult> => {
    const normalizedConversationIds = normalizeConversationIds(conversationIds)

    if (normalizedConversationIds.length === 0) {
      return {
        deletedConversationIds: [],
        failedConversationIds: [],
      }
    }

    const deletedConversationIds: string[] = []
    const failedConversationIds: string[] = []
    const conversationIdChunks = toConversationIdChunks(
      normalizedConversationIds,
      MAX_BULK_DELETE_CONVERSATION_IDS,
    )

    for (const conversationIdChunk of conversationIdChunks) {
      try {
        await apiClient.delete<unknown, BulkDeleteConversationsRequest>(API_ENDPOINTS.chat.bulkDelete, {
          body: {
            conversationIds: conversationIdChunk,
          },
          token,
        })

        deletedConversationIds.push(...conversationIdChunk)
      } catch {
        failedConversationIds.push(...conversationIdChunk)
      }
    }

    return {
      deletedConversationIds,
      failedConversationIds,
    }
  },
  createConversation,
  deleteConversation: async (conversationId: string, token: string) => {
    await apiClient.delete<unknown>(API_ENDPOINTS.chat.byId(conversationId), { token })
  },
  getConversation: async (conversationId: string, token: string) => {
    const response = await apiClient.get<unknown>(API_ENDPOINTS.chat.byId(conversationId), { token })
    const detail = normalizeConversationDetail(response)

    if (!detail) {
      throw new Error('Unable to normalize conversation detail from the API response.')
    }

    return detail
  },
  getUnreadCount,
  listConversations,
  listMessages,
  markConversationSeen: async (conversationId: string, token: string): Promise<SeenReceipt> => {
    const response = await apiClient.post<unknown, Record<string, never>>(
      API_ENDPOINTS.chat.seen(conversationId),
      {},
      { token },
    )

    if (isRecord(response)) {
      return {
        conversationId: toStringValue(response.conversationId ?? conversationId) || conversationId,
        lastSeenMessageId: toStringValue(response.lastSeenMessageId ?? response.messageId) || null,
        seenAt: toStringValue(response.seenAt ?? response.timestamp) || new Date().toISOString(),
        seenByUserId: toStringValue(response.seenByUserId ?? response.userId) || null,
      }
    }

    return {
      conversationId,
      lastSeenMessageId: null,
      seenAt: new Date().toISOString(),
      seenByUserId: null,
    }
  },
  sendMessage: async (
    conversationId: string,
    payload: SendMessagePayload,
    token: string,
    options?: MessageNormalizationOptions,
  ) => {
    const response = await apiClient.post<unknown, SendMessagePayload>(
      API_ENDPOINTS.chat.messages(conversationId),
      {
        ...payload,
        content: payload.content ?? payload.text,
      },
      { token },
    )

    const normalizedMessage = normalizeMessage(response, {
      ...options,
      fallbackConversationId: conversationId,
    })

    if (!normalizedMessage) {
      throw new Error('Unable to normalize sent message from the API response.')
    }

    return normalizedMessage
  },
  setConversationStarred: async (conversationId: string, isStarred: boolean, token: string) => {
    if (isStarred) {
      await apiClient.post<unknown, Record<string, never>>(API_ENDPOINTS.chat.starred(conversationId), {}, { token })
      return
    }

    await apiClient.delete<unknown>(API_ENDPOINTS.chat.starred(conversationId), { token })
  },
}
