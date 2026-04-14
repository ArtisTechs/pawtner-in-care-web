export type ConversationFolder =
  | 'INBOX'
  | 'STARRED'
  | 'SENT'
  | 'DRAFT'
  | 'SPAM'
  | 'IMPORTANT'
  | 'BIN'

export type ConversationReadState = 'UNREAD' | 'READ' | 'SEEN'

export type InboxFilterKey = 'ALL' | 'UNREAD' | 'READ' | 'STARRED'
export type ConversationStatusFilter = 'ACTIVE' | 'ARCHIVED' | 'STARRED' | 'UNREAD' | 'ALL'

export type MessageDirection = 'INCOMING' | 'OUTGOING'

export type MessageReadState = 'SENT' | 'DELIVERED' | 'READ' | 'SEEN'

export interface ChatParticipant {
  avatarUrl?: string | null
  displayName: string
  id: string
}

export interface ChatAttachment {
  mimeType?: string | null
  name: string
  size?: number | null
  url?: string | null
}

export interface ConversationSummary {
  folder: ConversationFolder
  id: string
  isImportant?: boolean
  isStarred?: boolean
  lastMessageAt?: string | null
  lastMessagePreview?: string | null
  lastMessageSeenAt?: string | null
  participant: ChatParticipant
  readState: ConversationReadState
  unreadCount: number
  updatedAt?: string | null
}

export interface ConversationPermissions {
  canSend: boolean
  canView: boolean
}

export interface ConversationDetail extends ConversationSummary {
  permissions?: ConversationPermissions
}

export interface ChatMessage {
  attachment?: ChatAttachment | null
  body?: string | null
  conversationId: string
  createdAt: string
  direction: MessageDirection
  id: string
  readState?: MessageReadState
  seenAt?: string | null
  sender: ChatParticipant
}

export interface SendMessagePayload {
  attachmentMimeType?: string | null
  attachmentName?: string | null
  attachmentSize?: number | null
  attachmentUrl?: string | null
  content?: string
  text?: string
}

export interface CreateConversationPayload {
  participantId?: string
  recipientUserId: string
}

export interface SeenReceipt {
  conversationId: string
  lastSeenMessageId?: string | null
  seenAt: string
  seenByUserId?: string | null
}

export interface UnreadCountSummary {
  totalUnreadCount: number
}

export interface PaginationMeta {
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface PaginatedConversationsResponse extends PaginationMeta {
  content: ConversationSummary[]
}

export interface PaginatedMessagesResponse extends PaginationMeta {
  content: ChatMessage[]
}

export interface ConversationListQuery {
  page?: number
  search?: string
  size?: number
  status?: ConversationStatusFilter
}

export interface MessageListQuery {
  page?: number
  sortDir?: 'asc' | 'desc'
  size?: number
}
