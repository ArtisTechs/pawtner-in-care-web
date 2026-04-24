import { API_CONFIG } from '@/config/env'
import SockJS from 'sockjs-client'
import { isInvalidBearerTokenMessage } from '@/shared/api/api-error'
import { emitAuthSessionInvalid } from '@/shared/api/auth-session-events'
import type { ChatMessage, ConversationSummary, SeenReceipt, UnreadCountSummary } from '@/features/chat/types/chat-api'
import type { NotificationItem } from '@/features/notifications/types/notification-api'
import type { NotificationRealtimeEvent } from '@/features/notifications/types/notification-realtime'
import type {
  ChatRealtimeConnectionState,
  ChatRealtimeEvent,
  ChatSendMessagePayload,
  ChatSendSeenPayload,
} from '@/features/chat/types/chat-realtime'

type Listener = (event: ChatRealtimeEvent) => void
type ConnectionListener = (state: ChatRealtimeConnectionState) => void
type NotificationListener = (event: NotificationRealtimeEvent) => void

type RealtimeSession = {
  token: string
  userId: string
}

type StompHeaders = Record<string, string>

type StompFrame = {
  body: string
  command: string
  headers: StompHeaders
}

interface WebSocketLike {
  close: () => void
  onclose: ((event: CloseEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent) => void) | null
  onopen: ((event: Event) => void) | null
  readyState: number
  send: (data: string) => void
}

type ResolvedServerEventType =
  | 'CONVERSATION_UPDATED'
  | 'MESSAGE_CREATED'
  | 'MESSAGE_SEEN'
  | 'NEW_MESSAGE'
  | 'UNREAD_COUNT_UPDATED'

const RECONNECT_BASE_DELAY_MS = 1000
const RECONNECT_MAX_DELAY_MS = 30000
const RECONNECT_JITTER_MAX_MS = 400
const HEARTBEAT_OUTBOUND_MS = 10000
const CONNECT_TIMEOUT_MS = 12000
const SOCKET_READY_STATE_CONNECTING = 0
const SOCKET_READY_STATE_OPEN = 1

const SOCKET_PATH = '/ws/chat'
const PREFERRED_SOCKET_PATHS = ['/api/ws/chat', '/ws/chat']

const USER_QUEUE_DESTINATION = '/user/queue/chat'
const USER_QUEUE_MESSAGES_DESTINATION = '/user/queue/messages'
const USER_QUEUE_CONVERSATIONS_DESTINATION = '/user/queue/conversations'
const USER_QUEUE_READ_RECEIPTS_DESTINATION = '/user/queue/read-receipts'
const USER_QUEUE_NOTIFICATIONS_DESTINATION = '/user/queue/notifications'
const LEGACY_USER_QUEUE_DESTINATIONS = [
  USER_QUEUE_MESSAGES_DESTINATION,
  USER_QUEUE_CONVERSATIONS_DESTINATION,
  USER_QUEUE_READ_RECEIPTS_DESTINATION,
]
const SEND_DESTINATION = '/app/chat.send'
const SEEN_DESTINATION = '/app/chat.seen'

const LEGACY_EVENT_TYPE_MAP: Record<string, ResolvedServerEventType> = {
  'conversation.updated': 'CONVERSATION_UPDATED',
  'message.created': 'MESSAGE_CREATED',
  'receipt.seen': 'MESSAGE_SEEN',
  'unread.updated': 'UNREAD_COUNT_UPDATED',
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object'

const toNumber = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return value
}

const toStringValue = (value: unknown) => {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
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

const shouldSubscribeLegacyQueues = () => {
  const rawFlag = toStringValue(import.meta.env.VITE_CHAT_WS_ENABLE_LEGACY_QUEUES).toLowerCase()
  return rawFlag === '1' || rawFlag === 'true'
}

const normalizeSocketProtocol = (url: URL) => {
  const isPageSecure = typeof window !== 'undefined' && window.location.protocol === 'https:'

  if (isPageSecure || url.protocol === 'https:' || url.protocol === 'wss:') {
    url.protocol = 'https:'
    return
  }

  url.protocol = 'http:'
}

const toSocketPath = (basePath: string, socketPath: string) => {
  const normalizedBase = basePath === '/' ? '' : basePath
  const combinedPath = `${normalizedBase}${socketPath}`

  if (!combinedPath) {
    return socketPath
  }

  return combinedPath.startsWith('/') ? combinedPath : `/${combinedPath}`
}

const normalizeSocketBaseUrl = (value: string) => {
  const normalizedValue = toStringValue(value)
  if (!normalizedValue) {
    return ''
  }

  let parsedUrl: URL | null = null

  try {
    parsedUrl = new URL(normalizedValue)
  } catch {
    if (typeof window !== 'undefined') {
      try {
        parsedUrl = new URL(normalizedValue, window.location.origin)
      } catch {
        parsedUrl = null
      }
    }
  }

  if (!parsedUrl) {
    return ''
  }

  normalizeSocketProtocol(parsedUrl)
  parsedUrl.search = ''
  parsedUrl.hash = ''

  return parsedUrl.toString()
}

const deriveSocketUrlsFromApiBase = () => {
  try {
    const parsedApiUrl = new URL(API_CONFIG.baseUrl)
    const normalizedApiPath = parsedApiUrl.pathname.replace(/\/+$/, '')
    const legacyApiPath = normalizedApiPath.replace(/\/api$/, '')

    normalizeSocketProtocol(parsedApiUrl)
    parsedApiUrl.search = ''
    parsedApiUrl.hash = ''

    const candidatePaths = [
      ...PREFERRED_SOCKET_PATHS,
      toSocketPath(normalizedApiPath, SOCKET_PATH),
      toSocketPath(legacyApiPath, SOCKET_PATH),
    ]

    const uniquePaths = Array.from(new Set(candidatePaths))

    return uniquePaths.map((pathname) => {
      const socketUrl = new URL(parsedApiUrl.toString())
      socketUrl.pathname = pathname
      return socketUrl.toString()
    })
  } catch {
    return [] as string[]
  }
}

const resolveSocketBaseUrls = () => {
  const configuredUrl = toStringValue(import.meta.env.VITE_CHAT_WS_URL)
  if (configuredUrl) {
    const normalizedConfiguredUrl = normalizeSocketBaseUrl(configuredUrl)
    if (!normalizedConfiguredUrl) {
      return []
    }

    try {
      const parsedConfiguredUrl = new URL(normalizedConfiguredUrl)
      const hasExplicitPath = Boolean(parsedConfiguredUrl.pathname && parsedConfiguredUrl.pathname !== '/')

      if (hasExplicitPath) {
        return [normalizedConfiguredUrl]
      }

      const preferredConfiguredUrls = PREFERRED_SOCKET_PATHS.map((pathname) => {
        const nextUrl = new URL(parsedConfiguredUrl.toString())
        nextUrl.pathname = pathname
        return nextUrl.toString()
      })

      return Array.from(new Set(preferredConfiguredUrls.map((url) => normalizeSocketBaseUrl(url)).filter(Boolean)))
    } catch {
      return [normalizedConfiguredUrl]
    }
  }

  const normalizedDerivedUrls = deriveSocketUrlsFromApiBase()
    .map((candidateUrl) => normalizeSocketBaseUrl(candidateUrl))
    .filter(Boolean)

  return Array.from(new Set(normalizedDerivedUrls))
}

const resolveEventType = (value: unknown): ResolvedServerEventType | null => {
  const rawType = toStringValue(value)
  if (!rawType) {
    return null
  }

  const upperType = rawType.toUpperCase()

  if (
    upperType === 'MESSAGE_CREATED' ||
    upperType === 'MESSAGE_SEEN' ||
    upperType === 'NEW_MESSAGE' ||
    upperType === 'MESSAGE' ||
    upperType === 'CHAT_MESSAGE' ||
    upperType === 'CONVERSATION_UPDATED' ||
    upperType === 'UNREAD_COUNT_UPDATED'
  ) {
    if (upperType === 'MESSAGE' || upperType === 'CHAT_MESSAGE') {
      return 'MESSAGE_CREATED'
    }

    return upperType
  }

  const legacyType = LEGACY_EVENT_TYPE_MAP[rawType.toLowerCase()]
  return legacyType ?? null
}

type NotificationServerEventType =
  | 'NOTIFICATION_CREATED'
  | 'NOTIFICATION_UPDATED'
  | 'NOTIFICATION_DELETED'
  | 'NOTIFICATION_READ_ALL'
  | 'NOTIFICATION_CLEARED_ALL'

const resolveNotificationEventType = (value: unknown): NotificationServerEventType | null => {
  const rawType = toStringValue(value).toUpperCase()

  if (
    rawType === 'NOTIFICATION_CREATED' ||
    rawType === 'NOTIFICATION_UPDATED' ||
    rawType === 'NOTIFICATION_DELETED' ||
    rawType === 'NOTIFICATION_READ_ALL' ||
    rawType === 'NOTIFICATION_CLEARED_ALL'
  ) {
    return rawType
  }

  return null
}

const encodeHeaderValue = (value: string) => {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/:/g, '\\c')
}

const decodeHeaderValue = (value: string) => {
  return value
    .replace(/\\c/g, ':')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\\\/g, '\\')
}

const buildStompFrame = (command: string, headers: StompHeaders, body = '') => {
  const headerEntries = Object.entries(headers).filter(([, value]) => value)
  const serializedHeaders = headerEntries
    .map(([key, value]) => `${key}:${encodeHeaderValue(value)}`)
    .join('\n')

  if (!serializedHeaders) {
    return `${command}\n\n${body}\0`
  }

  return `${command}\n${serializedHeaders}\n\n${body}\0`
}

const parseStompFrame = (rawFrame: string): StompFrame | null => {
  const normalizedFrame = rawFrame.replace(/\r/g, '')
  const trimmedFrame = normalizedFrame.trim()

  if (!trimmedFrame) {
    return null
  }

  const separatorIndex = normalizedFrame.indexOf('\n\n')
  const headerBlock = separatorIndex >= 0 ? normalizedFrame.slice(0, separatorIndex) : normalizedFrame
  const body = separatorIndex >= 0 ? normalizedFrame.slice(separatorIndex + 2) : ''

  const headerLines = headerBlock.split('\n')
  const command = headerLines.shift()?.trim() ?? ''
  if (!command) {
    return null
  }

  const headers: StompHeaders = {}

  for (const line of headerLines) {
    if (!line) {
      continue
    }

    const separator = line.indexOf(':')
    if (separator < 0) {
      continue
    }

    const rawKey = line.slice(0, separator)
    const rawValue = line.slice(separator + 1)

    headers[rawKey] = decodeHeaderValue(rawValue)
  }

  return {
    body,
    command,
    headers,
  }
}

const parseSocketPayload = (rawData: unknown): unknown => {
  if (typeof rawData === 'string') {
    const normalized = rawData.trim()
    if (!normalized) {
      return null
    }

    try {
      return JSON.parse(normalized)
    } catch {
      return null
    }
  }

  if (rawData instanceof ArrayBuffer) {
    try {
      const text = new TextDecoder().decode(rawData).trim()
      return text ? JSON.parse(text) : null
    } catch {
      return null
    }
  }

  return rawData
}

const parseJsonRecord = (value: unknown): Record<string, unknown> | null => {
  if (isRecord(value)) {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  if (!normalized) {
    return null
  }

  try {
    const parsedValue = JSON.parse(normalized)
    return isRecord(parsedValue) ? parsedValue : null
  } catch {
    return null
  }
}

const asConversationSummary = (value: unknown): ConversationSummary | null => {
  if (!isRecord(value)) {
    return null
  }

  const id = toStringValue(value.id ?? value.conversationId)
  if (!id) {
    return null
  }

  const participantValue = isRecord(value.participant) ? value.participant : null
  const otherParticipantValue = isRecord(value.otherParticipant) ? value.otherParticipant : null
  const participantId = toStringValue(
    participantValue?.id ??
      participantValue?.userId ??
      otherParticipantValue?.id ??
      otherParticipantValue?.userId ??
      value.participantId,
  )
  const otherFirstName = toStringValue(otherParticipantValue?.firstName)
  const otherLastName = toStringValue(otherParticipantValue?.lastName)
  const otherFullName = [otherFirstName, otherLastName].filter(Boolean).join(' ').trim()
  const participantDisplayName =
    toStringValue(
      participantValue?.displayName ??
        participantValue?.name ??
        otherParticipantValue?.displayName ??
        otherParticipantValue?.name ??
        value.participantName,
    ) ||
    otherFullName ||
    'User'

  const unreadCountValue = toNumber(value.unreadCount ?? value.unreadMessages)
  const resolvedUnreadCount = unreadCountValue ? Math.max(0, Math.floor(unreadCountValue)) : 0
  const lastMessageValue = isRecord(value.lastMessage) ? value.lastMessage : null

  return {
    folder: 'INBOX',
    id,
    isImportant: Boolean(value.isImportant),
    isStarred: Boolean(value.isStarred ?? value.starred),
    lastMessageAt: toStringValue(value.lastMessageAt ?? lastMessageValue?.createdAt) || null,
    lastMessagePreview:
      toStringValue(
        value.lastMessagePreview ??
          value.preview ??
          value.contentPreview ??
          lastMessageValue?.content ??
          lastMessageValue?.body ??
          lastMessageValue?.text ??
          lastMessageValue?.contentPreview,
      ) || null,
    lastMessageSeenAt: toStringValue(value.lastMessageSeenAt) || null,
    participant: {
      avatarUrl:
        toStringValue(
          participantValue?.avatarUrl ??
            participantValue?.profilePicture ??
            otherParticipantValue?.avatarUrl ??
            otherParticipantValue?.profilePicture,
        ) || null,
      displayName: participantDisplayName,
      id: participantId || 'unknown-user',
    },
    readState: resolvedUnreadCount > 0 ? 'UNREAD' : 'READ',
    unreadCount: resolvedUnreadCount,
    updatedAt: toStringValue(value.updatedAt) || null,
  }
}

const asChatMessage = (
  value: unknown,
  currentUserId: string,
  fallbackConversationId = '',
): ChatMessage | null => {
  if (!isRecord(value)) {
    return null
  }

  const messageId = toStringValue(value.id ?? value.messageId)
  if (!messageId) {
    return null
  }

  const conversationId = toStringValue(value.conversationId ?? fallbackConversationId)
  if (!conversationId) {
    return null
  }

  const senderValue = isRecord(value.sender) ? value.sender : null
  const senderId = toStringValue(senderValue?.id ?? senderValue?.userId ?? value.senderId)
  const recipientId = toStringValue(value.recipientId)

  let direction: 'INCOMING' | 'OUTGOING' = 'INCOMING'
  const directionValue = toStringValue(value.direction).toUpperCase()
  if (directionValue === 'INCOMING' || directionValue === 'OUTGOING') {
    direction = directionValue
  } else if (senderId && senderId === currentUserId) {
    direction = 'OUTGOING'
  } else if (recipientId && recipientId === currentUserId) {
    direction = 'INCOMING'
  }

  const createdAt =
    toStringValue(value.createdAt ?? value.sentAt ?? value.timestamp) || new Date().toISOString()

  const body = toStringValue(
    value.body ?? value.content ?? value.text ?? value.contentPreview ?? value.preview ?? value.lastMessagePreview,
  )
  const seen = Boolean(value.seen) || Boolean(toStringValue(value.seenAt))
  const firstName = toStringValue(senderValue?.firstName)
  const lastName = toStringValue(senderValue?.lastName)
  const senderFullName = [firstName, lastName].filter(Boolean).join(' ').trim()
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
  const attachment =
    resolvedAttachmentName || attachmentUrl
      ? {
          mimeType: toStringValue(attachmentValue?.mimeType ?? value.attachmentMimeType) || null,
          name: resolvedAttachmentName,
          size: toNumber(attachmentValue?.size ?? value.attachmentSize),
          url: attachmentUrl,
        }
      : null

  return {
    attachment,
    body: body || null,
    conversationId,
    createdAt,
    direction,
    id: messageId,
    readState: direction === 'OUTGOING' ? (seen ? 'SEEN' : 'SENT') : seen ? 'SEEN' : 'READ',
    seenAt: toStringValue(value.seenAt) || null,
    sender: {
      avatarUrl: toStringValue(senderValue?.avatarUrl ?? senderValue?.profilePicture) || null,
      displayName:
        toStringValue(senderValue?.displayName ?? senderValue?.name ?? value.senderName) ||
        senderFullName ||
        (direction === 'OUTGOING' ? 'You' : 'User'),
      id: senderId || 'unknown-user',
    },
  }
}

const asSeenReceipt = (value: unknown, fallbackConversationId = ''): SeenReceipt | null => {
  if (!isRecord(value)) {
    return null
  }

  const conversationId = toStringValue(value.conversationId ?? fallbackConversationId)
  if (!conversationId) {
    return null
  }

  return {
    conversationId,
    lastSeenMessageId: toStringValue(value.lastSeenMessageId ?? value.messageId) || null,
    seenAt: toStringValue(value.seenAt ?? value.timestamp) || new Date().toISOString(),
    seenByUserId: toStringValue(value.seenByUserId ?? value.userId) || null,
  }
}

const asUnreadSummary = (value: unknown): UnreadCountSummary | null => {
  if (!isRecord(value)) {
    return null
  }

  const unreadValue = toNumber(value.totalUnreadCount ?? value.totalUnread ?? value.unreadCount)

  if (unreadValue === null) {
    return null
  }

  return {
    totalUnreadCount: Math.max(0, Math.floor(unreadValue)),
  }
}

const asNotificationType = (value: unknown): NotificationItem['type'] => {
  const normalized = toStringValue(value).toUpperCase()

  if (
    normalized === 'ADOPTION' ||
    normalized === 'DONATION_LOG' ||
    normalized === 'GIFT_LOG' ||
    normalized === 'COMMUNITY_LOG' ||
    normalized === 'SOS_LOG' ||
    normalized === 'ACHIEVEMENT' ||
    normalized === 'TODO' ||
    normalized === 'CHAT' ||
    normalized === 'SYSTEM'
  ) {
    return normalized
  }

  return normalized || 'SYSTEM'
}

const asNotificationReferenceType = (value: unknown): NotificationItem['referenceType'] => {
  const normalized = toStringValue(value).toUpperCase()

  if (
    normalized === 'ADOPTION_REQUEST' ||
    normalized === 'DONATION_TRANSACTION' ||
    normalized === 'GIFT_ENTRY' ||
    normalized === 'COMMUNITY_POST' ||
    normalized === 'EMERGENCY_SOS' ||
    normalized === 'ACHIEVEMENT' ||
    normalized === 'TODO_ITEM' ||
    normalized === 'CHAT_CONVERSATION' ||
    normalized === 'SUPPORT_CONVERSATION' ||
    normalized === 'PET' ||
    normalized === 'OTHER'
  ) {
    return normalized
  }

  return normalized || 'OTHER'
}

const asNotificationItem = (value: unknown): NotificationItem | null => {
  if (!isRecord(value)) {
    return null
  }

  const id = toStringValue(value.id ?? value.notificationId)
  if (!id) {
    return null
  }

  const nowIso = new Date().toISOString()

  return {
    createdAt: toStringValue(value.createdAt ?? value.createdDate) || nowIso,
    createdByUserId: toStringValue(value.createdByUserId ?? value.createdById ?? value.createdBy) || null,
    id,
    isRead: Boolean(value.isRead ?? value.read),
    message: toStringValue(value.message ?? value.content ?? value.body),
    referenceId: toStringValue(value.referenceId) || null,
    referenceType: asNotificationReferenceType(value.referenceType),
    title: toStringValue(value.title) || 'Notification',
    type: asNotificationType(value.type),
    updatedAt: toStringValue(value.updatedAt ?? value.updatedDate ?? value.createdAt) || nowIso,
  }
}

const asNotificationUnreadCount = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value))
  }

  if (!isRecord(value)) {
    return null
  }

  const candidates = [
    toNumber(value.unreadCount),
    toNumber(value.totalUnreadCount),
    toNumber(value.totalUnread),
    toNumber(value.total),
    toNumber(value.count),
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'number') {
      return Math.max(0, Math.floor(candidate))
    }
  }

  return null
}

const toNotificationRealtimeEvents = (
  value: unknown,
  destinationHint = '',
): NotificationRealtimeEvent[] => {
  if (destinationHint.trim() !== USER_QUEUE_NOTIFICATIONS_DESTINATION) {
    return []
  }

  const envelope = parseJsonRecord(value)
  if (!envelope) {
    return []
  }

  const root = parseJsonRecord(envelope.payload) ?? parseJsonRecord(envelope.data) ?? envelope
  const eventType = resolveNotificationEventType(
    envelope.eventType ??
      root.eventType ??
      envelope.type ??
      root.type ??
      envelope.event ??
      root.event ??
      envelope.eventName ??
      root.eventName,
  )

  if (!eventType) {
    return []
  }

  const notificationPayload = parseJsonRecord(root.notification) ?? root.notification ?? root
  const notification = asNotificationItem(notificationPayload)
  const notificationId =
    toStringValue(root.notificationId ?? (isRecord(root.notification) ? root.notification.id : undefined) ?? root.id) ||
    null

  return [
    {
      eventType,
      notification,
      notificationId,
      unreadCount: asNotificationUnreadCount(root),
    },
  ]
}

const isLikelyMessagePayload = (value: unknown, fallbackConversationId = '') => {
  if (!isRecord(value)) {
    return false
  }

  const messageId = toStringValue(value.id ?? value.messageId)
  const conversationId = toStringValue(value.conversationId ?? fallbackConversationId)
  return Boolean(messageId && conversationId)
}

const isLikelySeenPayload = (value: unknown, fallbackConversationId = '') => {
  if (!isRecord(value)) {
    return false
  }

  const conversationId = toStringValue(value.conversationId ?? fallbackConversationId)
  const seenAt = toStringValue(value.seenAt ?? value.timestamp)
  const messageId = toStringValue(value.lastSeenMessageId ?? value.messageId)
  return Boolean(conversationId && (seenAt || messageId))
}

const isLikelyConversationPayload = (value: unknown, fallbackConversationId = '') => {
  if (!isRecord(value)) {
    return false
  }

  const conversationId = toStringValue(value.id ?? value.conversationId ?? fallbackConversationId)
  const hasConversationFields =
    Boolean(toStringValue(value.lastMessageAt ?? value.updatedAt ?? value.lastMessagePreview)) ||
    toNumber(value.unreadCount ?? value.unreadMessages) !== null

  return Boolean(conversationId && hasConversationFields)
}

const toRealtimeEvents = (
  value: unknown,
  currentUserId: string,
  destinationHint = '',
): ChatRealtimeEvent[] => {
  const envelope = parseJsonRecord(value)
  if (!envelope) {
    return []
  }

  const root = parseJsonRecord(envelope.payload) ?? parseJsonRecord(envelope.data) ?? envelope
  const eventType = resolveEventType(
    envelope.type ??
      root.type ??
      envelope.eventType ??
      root.eventType ??
      envelope.event ??
      root.event ??
      envelope.eventName ??
      root.eventName,
  )
  const fallbackConversationId = toStringValue(root.conversationId ?? envelope.conversationId)

  const destination = destinationHint.trim()
  if (destination === USER_QUEUE_NOTIFICATIONS_DESTINATION) {
    return []
  }

  const events: ChatRealtimeEvent[] = []

  if (eventType === 'NEW_MESSAGE' || eventType === 'MESSAGE_CREATED') {
    const messageRoot = parseJsonRecord(root.message) ?? root
    const message = asChatMessage(messageRoot, currentUserId, fallbackConversationId)
    if (message) {
      events.push({
        type: 'NEW_MESSAGE',
        payload: message,
      })
    }
  }

  if (eventType === 'CONVERSATION_UPDATED') {
    const conversationRoot = parseJsonRecord(root.conversation) ?? root
    const conversation = asConversationSummary(conversationRoot)
    if (conversation) {
      events.push({
        type: 'CONVERSATION_UPDATED',
        payload: conversation,
      })
    }
  }

  if (eventType === 'MESSAGE_SEEN') {
    const seenRoot = parseJsonRecord(root.seen) ?? root
    const seenReceipt = asSeenReceipt(seenRoot, fallbackConversationId)
    if (seenReceipt) {
      events.push({
        type: 'MESSAGE_SEEN',
        payload: seenReceipt,
      })
    }
  }

  if (eventType === 'UNREAD_COUNT_UPDATED') {
    const unreadSummary = asUnreadSummary(root)
    if (unreadSummary) {
      events.push({
        type: 'UNREAD_COUNT_UPDATED',
        payload: unreadSummary,
      })
    }
  }

  if (events.length === 0 && !eventType) {
    const messageRoot = parseJsonRecord(root.message) ?? root
    const conversationRoot = parseJsonRecord(root.conversation) ?? root
    const seenRoot = parseJsonRecord(root.seen) ?? root

    if (
      destination === USER_QUEUE_DESTINATION &&
      isLikelyMessagePayload(messageRoot, fallbackConversationId)
    ) {
      const message = asChatMessage(messageRoot, currentUserId, fallbackConversationId)
      if (message) {
        events.push({
          type: 'NEW_MESSAGE',
          payload: message,
        })
      }
    }

    if (
      destination === USER_QUEUE_DESTINATION &&
      events.length === 0 &&
      isLikelySeenPayload(seenRoot, fallbackConversationId)
    ) {
      const seenReceipt = asSeenReceipt(seenRoot, fallbackConversationId)
      if (seenReceipt) {
        events.push({
          type: 'MESSAGE_SEEN',
          payload: seenReceipt,
        })
      }
    }

    if (
      destination === USER_QUEUE_DESTINATION &&
      isLikelyConversationPayload(conversationRoot, fallbackConversationId)
    ) {
      const conversation = asConversationSummary(conversationRoot)
      if (conversation) {
        events.push({
          type: 'CONVERSATION_UPDATED',
          payload: conversation,
        })
      }
    }

    if (destination === USER_QUEUE_MESSAGES_DESTINATION) {
      const message = asChatMessage(messageRoot, currentUserId, fallbackConversationId)
      if (message) {
        events.push({
          type: 'NEW_MESSAGE',
          payload: message,
        })
      }
    }

    if (destination === USER_QUEUE_CONVERSATIONS_DESTINATION) {
      const conversation = asConversationSummary(conversationRoot)
      if (conversation) {
        events.push({
          type: 'CONVERSATION_UPDATED',
          payload: conversation,
        })
      }
    }

    if (destination === USER_QUEUE_READ_RECEIPTS_DESTINATION) {
      const seenReceipt = asSeenReceipt(seenRoot, fallbackConversationId)
      if (seenReceipt) {
        events.push({
          type: 'MESSAGE_SEEN',
          payload: seenReceipt,
        })
      }
    }
  }

  if (isRecord(root.conversation)) {
    const conversation = asConversationSummary(root.conversation)

    if (conversation) {
      events.push({
        type: 'CONVERSATION_UPDATED',
        payload: conversation,
      })
    }
  }

  const unreadSummary = asUnreadSummary(root)
  if (unreadSummary) {
    events.push({
      type: 'UNREAD_COUNT_UPDATED',
      payload: unreadSummary,
    })
  }

  // De-duplicate events that can be emitted from both explicit and inferred paths.
  const dedupedEvents = new Map<string, ChatRealtimeEvent>()
  events.forEach((event) => {
    if (event.type === 'NEW_MESSAGE') {
      dedupedEvents.set(`${event.type}:${event.payload.id}`, event)
      return
    }

    if (event.type === 'MESSAGE_SEEN') {
      dedupedEvents.set(`${event.type}:${event.payload.conversationId}:${event.payload.seenAt}`, event)
      return
    }

    if (event.type === 'CONVERSATION_UPDATED') {
      dedupedEvents.set(`${event.type}:${event.payload.id}`, event)
      return
    }

    dedupedEvents.set(`${event.type}`, event)
  })

  return Array.from(dedupedEvents.values())
}

const resolveStompErrorStatus = (frame: StompFrame, payload: Record<string, unknown> | null) => {
  const payloadStatus = toNumber(payload?.status)
  if (payloadStatus !== null) {
    return payloadStatus
  }

  const headerStatus = Number(frame.headers.status)
  return Number.isFinite(headerStatus) ? headerStatus : null
}

const resolveStompErrorMessage = (frame: StompFrame, payload: Record<string, unknown> | null) => {
  const payloadMessage = toStringValue(
    payload?.message ?? payload?.error ?? payload?.detail ?? payload?.description,
  )

  if (payloadMessage) {
    return payloadMessage
  }

  const headerMessage = toStringValue(frame.headers.message)
  if (headerMessage) {
    return headerMessage
  }

  return toStringValue(frame.body)
}

class ChatRealtimeService {
  private listeners = new Set<Listener>()
  private notificationListeners = new Set<NotificationListener>()
  private connectionListeners = new Set<ConnectionListener>()
  private socket: WebSocketLike | null = null
  private socketBaseUrlIndex = 0
  private reconnectTimeoutId: number | null = null
  private connectTimeoutId: number | null = null
  private heartbeatIntervalId: number | null = null
  private reconnectAttempt = 0
  private session: RealtimeSession | null = null
  private shouldReconnect = false
  private frameBuffer = ''
  private isStompConnected = false
  private subscribedUserDestinations = new Set<string>()
  private connectionState: ChatRealtimeConnectionState = {
    isConnected: false,
    reconnectAttempt: 0,
    status: 'DISCONNECTED',
  }

  startSession(session: RealtimeSession) {
    const normalizedToken = session.token.trim()
    const normalizedUserId = session.userId.trim()

    if (!normalizedToken || !normalizedUserId) {
      this.stopSession()
      return
    }

    const isSameSession =
      this.session?.token === normalizedToken && this.session?.userId === normalizedUserId

    this.session = {
      token: normalizedToken,
      userId: normalizedUserId,
    }
    this.shouldReconnect = true

    if (
      isSameSession &&
      (this.isStompConnected ||
        this.socket?.readyState === SOCKET_READY_STATE_CONNECTING ||
        this.socket?.readyState === SOCKET_READY_STATE_OPEN)
    ) {
      return
    }

    this.clearReconnectTimer()
    this.clearConnectTimeout()
    this.closeSocket()
    this.connect()
  }

  reconnect() {
    if (!this.session || !this.shouldReconnect) {
      return
    }

    this.reconnectAttempt = 0
    this.clearReconnectTimer()
    this.clearConnectTimeout()
    this.closeSocket()
    this.connect()
  }

  stopSession() {
    this.shouldReconnect = false
    this.session = null
    this.socketBaseUrlIndex = 0
    this.reconnectAttempt = 0
    this.frameBuffer = ''
    this.isStompConnected = false
    this.subscribedUserDestinations.clear()

    this.clearReconnectTimer()
    this.clearConnectTimeout()
    this.clearHeartbeat()
    this.closeSocket()

    this.setConnectionState({
      isConnected: false,
      reconnectAttempt: 0,
      status: 'DISCONNECTED',
    })
  }

  sendMessage(payload: ChatSendMessagePayload) {
    const conversationId = payload.conversationId.trim()
    const content = payload.content.trim()

    if (!conversationId || !content) {
      return false
    }

    return this.sendStompFrame(
      'SEND',
      {
        destination: SEND_DESTINATION,
        'content-type': 'application/json',
      },
      JSON.stringify({
        conversationId,
        content,
      }),
    )
  }

  sendSeen(payload: ChatSendSeenPayload) {
    const conversationId = payload.conversationId.trim()

    if (!conversationId) {
      return false
    }

    return this.sendStompFrame(
      'SEND',
      {
        destination: SEEN_DESTINATION,
        'content-type': 'application/json',
      },
      JSON.stringify({
        conversationId,
      }),
    )
  }

  isConnected() {
    return this.connectionState.isConnected
  }

  getConnectionState() {
    return { ...this.connectionState }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  subscribeNotification(listener: NotificationListener) {
    this.notificationListeners.add(listener)

    return () => {
      this.notificationListeners.delete(listener)
    }
  }

  subscribeConnection(listener: ConnectionListener) {
    this.connectionListeners.add(listener)

    return () => {
      this.connectionListeners.delete(listener)
    }
  }

  private connect() {
    if (!this.session || !this.shouldReconnect) {
      return
    }

    if (
      this.socket?.readyState === SOCKET_READY_STATE_CONNECTING ||
      this.socket?.readyState === SOCKET_READY_STATE_OPEN
    ) {
      return
    }

    const socketBaseUrls = resolveSocketBaseUrls()
    if (socketBaseUrls.length === 0) {
      this.setConnectionState({
        isConnected: false,
        reconnectAttempt: this.reconnectAttempt,
        status: 'DISCONNECTED',
      })
      return
    }

    const socketBaseUrlIndex = this.socketBaseUrlIndex % socketBaseUrls.length
    const socketBaseUrl = socketBaseUrls[socketBaseUrlIndex]

    let socketUrl: URL

    try {
      socketUrl = new URL(socketBaseUrl)
    } catch {
      if (socketBaseUrls.length > 1) {
        this.socketBaseUrlIndex = (socketBaseUrlIndex + 1) % socketBaseUrls.length
      }

      this.setConnectionState({
        isConnected: false,
        reconnectAttempt: this.reconnectAttempt,
        status: 'DISCONNECTED',
      })

      this.scheduleReconnect()
      return
    }

    this.setConnectionState({
      isConnected: false,
      reconnectAttempt: this.reconnectAttempt,
      status: 'CONNECTING',
    })

    try {
      const socket = new SockJS(socketUrl.toString()) as unknown as WebSocketLike
      let hasOpened = false
      this.socket = socket
      this.frameBuffer = ''
      this.isStompConnected = false
      this.subscribedUserDestinations.clear()
      this.clearConnectTimeout()
      this.connectTimeoutId = window.setTimeout(() => {
        if (this.socket !== socket || this.isStompConnected) {
          return
        }

        if (!hasOpened && socketBaseUrls.length > 1) {
          this.socketBaseUrlIndex = (socketBaseUrlIndex + 1) % socketBaseUrls.length
        }

        this.setConnectionState({
          isConnected: false,
          reconnectAttempt: this.reconnectAttempt,
          status: 'DISCONNECTED',
        })
        this.closeSocket()
        this.scheduleReconnect()
      }, CONNECT_TIMEOUT_MS)

      socket.onopen = () => {
        if (this.socket !== socket || !this.session) {
          return
        }

        hasOpened = true
        this.socketBaseUrlIndex = socketBaseUrlIndex

        this.sendStompFrame(
          'CONNECT',
          {
            'accept-version': '1.2,1.1,1.0',
            Authorization: `Bearer ${this.session.token}`,
            'heart-beat': `${HEARTBEAT_OUTBOUND_MS},${HEARTBEAT_OUTBOUND_MS}`,
          },
          '',
          true,
        )
      }

      socket.onmessage = (event) => {
        if (this.socket !== socket) {
          return
        }

        this.handleSocketMessage(event.data)
      }

      socket.onerror = () => {
        if (this.socket !== socket) {
          return
        }

        if (!hasOpened && socketBaseUrls.length > 1) {
          this.socketBaseUrlIndex = (socketBaseUrlIndex + 1) % socketBaseUrls.length
        }

        this.clearConnectTimeout()

        this.setConnectionState({
          isConnected: false,
          reconnectAttempt: this.reconnectAttempt,
          status: 'DISCONNECTED',
        })

        this.closeSocket()
        this.scheduleReconnect()
      }

      socket.onclose = () => {
        if (this.socket !== socket) {
          return
        }

        if (!hasOpened && socketBaseUrls.length > 1) {
          this.socketBaseUrlIndex = (socketBaseUrlIndex + 1) % socketBaseUrls.length
        } else {
          this.socketBaseUrlIndex = socketBaseUrlIndex
        }

        this.clearConnectTimeout()
        this.clearHeartbeat()
        this.socket = null
        this.frameBuffer = ''
        this.isStompConnected = false
        this.subscribedUserDestinations.clear()

        this.setConnectionState({
          isConnected: false,
          reconnectAttempt: this.reconnectAttempt,
          status: 'DISCONNECTED',
        })

        this.scheduleReconnect()
      }
    } catch {
      this.clearConnectTimeout()
      if (socketBaseUrls.length > 1) {
        this.socketBaseUrlIndex = (socketBaseUrlIndex + 1) % socketBaseUrls.length
      }

      this.setConnectionState({
        isConnected: false,
        reconnectAttempt: this.reconnectAttempt,
        status: 'DISCONNECTED',
      })

      this.scheduleReconnect()
    }
  }

  private handleSocketMessage(rawData: unknown) {
    let chunk = ''

    if (typeof rawData === 'string') {
      chunk = rawData
    } else if (rawData instanceof ArrayBuffer) {
      chunk = new TextDecoder().decode(rawData)
    } else {
      return
    }

    if (!chunk) {
      return
    }

    this.frameBuffer += chunk

    while (true) {
      const frameEndIndex = this.frameBuffer.indexOf('\0')
      if (frameEndIndex < 0) {
        break
      }

      const rawFrame = this.frameBuffer.slice(0, frameEndIndex)
      this.frameBuffer = this.frameBuffer.slice(frameEndIndex + 1)

      const parsedFrame = parseStompFrame(rawFrame)
      if (!parsedFrame) {
        continue
      }

      this.handleStompFrame(parsedFrame)
    }
  }

  private handleStompFrame(frame: StompFrame) {
    if (frame.command === 'CONNECTED') {
      this.clearReconnectTimer()
      this.clearConnectTimeout()
      this.reconnectAttempt = 0
      this.isStompConnected = true

      this.setConnectionState({
        isConnected: true,
        reconnectAttempt: 0,
        status: 'CONNECTED',
      })

      this.subscribeUserQueue()
      this.startHeartbeat()
      return
    }

    if (frame.command === 'MESSAGE') {
      if (!this.session) {
        return
      }

      const payload = parseSocketPayload(frame.body)
      const events = toRealtimeEvents(payload, this.session.userId, frame.headers.destination)
      const notificationEvents = toNotificationRealtimeEvents(payload, frame.headers.destination)

      events.forEach((event) => {
        this.notifyEvent(event)
      })

      notificationEvents.forEach((event) => {
        this.notifyNotificationEvent(event)
      })
      return
    }

    if (frame.command === 'ERROR') {
      const errorPayload = parseJsonRecord(frame.body)
      const errorMessage = resolveStompErrorMessage(frame, errorPayload)
      const errorStatus = resolveStompErrorStatus(frame, errorPayload)
      const shouldInvalidateSession =
        errorStatus === 401 || isInvalidBearerTokenMessage(errorMessage)

      if (this.session && shouldInvalidateSession) {
        emitAuthSessionInvalid({
          message: errorMessage || 'Session expired. Please log in again.',
          path: SOCKET_PATH,
          status: errorStatus ?? 401,
        })

        this.stopSession()
        return
      }

      this.clearConnectTimeout()
      this.setConnectionState({
        isConnected: false,
        reconnectAttempt: this.reconnectAttempt,
        status: 'DISCONNECTED',
      })

      this.closeSocket()
      this.scheduleReconnect()
    }
  }

  private subscribeUserQueue() {
    const destinations = shouldSubscribeLegacyQueues()
      ? [USER_QUEUE_DESTINATION, USER_QUEUE_NOTIFICATIONS_DESTINATION, ...LEGACY_USER_QUEUE_DESTINATIONS]
      : [USER_QUEUE_DESTINATION, USER_QUEUE_NOTIFICATIONS_DESTINATION]

    destinations.forEach((destination) => {
      if (this.subscribedUserDestinations.has(destination)) {
        return
      }

      const sent = this.sendStompFrame(
        'SUBSCRIBE',
        {
          ack: 'auto',
          destination,
          id: `chat-user-queue-${destination.replace(/\//g, '-')}`,
        },
        '',
        true,
      )

      if (sent) {
        this.subscribedUserDestinations.add(destination)
      }
    })
  }

  private sendStompFrame(command: string, headers: StompHeaders, body = '', allowBeforeConnected = false) {
    if (!this.socket || this.socket.readyState !== SOCKET_READY_STATE_OPEN) {
      return false
    }

    if (!allowBeforeConnected && !this.isStompConnected) {
      return false
    }

    try {
      const frame = buildStompFrame(command, headers, body)
      this.socket.send(frame)
      return true
    } catch {
      return false
    }
  }

  private notifyEvent(event: ChatRealtimeEvent) {
    this.listeners.forEach((listener) => {
      listener(event)
    })
  }

  private notifyNotificationEvent(event: NotificationRealtimeEvent) {
    this.notificationListeners.forEach((listener) => {
      listener(event)
    })
  }

  private setConnectionState(state: ChatRealtimeConnectionState) {
    this.connectionState = state

    this.connectionListeners.forEach((listener) => {
      listener(this.connectionState)
    })
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect || !this.session || this.reconnectTimeoutId !== null) {
      return
    }

    const baseDelay = Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempt)
    const jitter = Math.floor(Math.random() * RECONNECT_JITTER_MAX_MS)
    const delay = Math.min(RECONNECT_MAX_DELAY_MS, baseDelay + jitter)

    this.reconnectAttempt += 1

    this.setConnectionState({
      isConnected: false,
      reconnectAttempt: this.reconnectAttempt,
      status: 'DISCONNECTED',
    })

    this.reconnectTimeoutId = window.setTimeout(() => {
      this.reconnectTimeoutId = null
      this.connect()
    }, delay)
  }

  private clearReconnectTimer() {
    if (this.reconnectTimeoutId === null) {
      return
    }

    window.clearTimeout(this.reconnectTimeoutId)
    this.reconnectTimeoutId = null
  }

  private clearConnectTimeout() {
    if (this.connectTimeoutId === null) {
      return
    }

    window.clearTimeout(this.connectTimeoutId)
    this.connectTimeoutId = null
  }

  private startHeartbeat() {
    this.clearHeartbeat()

    this.heartbeatIntervalId = window.setInterval(() => {
      if (!this.socket || this.socket.readyState !== SOCKET_READY_STATE_OPEN || !this.isStompConnected) {
        return
      }

      try {
        this.socket.send('\n')
      } catch {
        // Ignore heartbeat send failures.
      }
    }, HEARTBEAT_OUTBOUND_MS)
  }

  private clearHeartbeat() {
    if (this.heartbeatIntervalId === null) {
      return
    }

    window.clearInterval(this.heartbeatIntervalId)
    this.heartbeatIntervalId = null
  }

  private closeSocket() {
    if (!this.socket) {
      return
    }

    this.clearConnectTimeout()
    this.clearHeartbeat()

    this.socket.onopen = null
    this.socket.onmessage = null
    this.socket.onerror = null
    this.socket.onclose = null
    this.socket.close()
    this.socket = null
    this.frameBuffer = ''
    this.isStompConnected = false
    this.subscribedUserDestinations.clear()
  }
}

export const chatRealtimeService = new ChatRealtimeService()
