import type {
  ChatMessage,
  ConversationDetail,
  ConversationSummary,
  PaginatedConversationsResponse,
  PaginatedMessagesResponse,
  UnreadCountSummary,
} from '@/features/chat/types/chat-api'

const nowIso = new Date().toISOString()

export const chatMockConversations: ConversationSummary[] = [
  {
    folder: 'INBOX',
    id: 'conv-001',
    isStarred: false,
    lastMessageAt: nowIso,
    lastMessagePreview: 'Our Bachelor of Commerce program is ACBSP-accredited.',
    participant: {
      displayName: 'John Rey',
      id: 'usr-1001',
    },
    readState: 'UNREAD',
    unreadCount: 2,
    updatedAt: nowIso,
  },
  {
    folder: 'INBOX',
    id: 'conv-002',
    isStarred: true,
    lastMessageAt: nowIso,
    lastMessagePreview: 'Get best advertiser in your side pocket.',
    participant: {
      displayName: 'Alwin Manabat',
      id: 'usr-1002',
    },
    readState: 'READ',
    unreadCount: 0,
    updatedAt: nowIso,
  },
]

export const chatMockConversationDetail: ConversationDetail = {
  ...chatMockConversations[0],
  permissions: {
    canSend: true,
    canView: true,
  },
}

export const chatMockMessages: ChatMessage[] = [
  {
    body: 'It is a long established fact that a reader will be distracted by readable content.',
    conversationId: 'conv-001',
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    direction: 'INCOMING',
    id: 'msg-001',
    readState: 'READ',
    sender: {
      displayName: 'John Rey',
      id: 'usr-1001',
    },
  },
  {
    body: 'There are many variations of passages of Lorem Ipsum available.',
    conversationId: 'conv-001',
    createdAt: new Date(Date.now() - 1000 * 60 * 11).toISOString(),
    direction: 'OUTGOING',
    id: 'msg-002',
    readState: 'SEEN',
    seenAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    sender: {
      displayName: 'Admin',
      id: 'admin-user',
    },
  },
]

export const chatMockConversationsPage: PaginatedConversationsResponse = {
  content: chatMockConversations,
  page: 0,
  size: 12,
  totalElements: chatMockConversations.length,
  totalPages: 1,
}

export const chatMockMessagesPage: PaginatedMessagesResponse = {
  content: chatMockMessages,
  page: 0,
  size: 30,
  totalElements: chatMockMessages.length,
  totalPages: 1,
}

export const chatMockUnreadSummary: UnreadCountSummary = {
  totalUnreadCount: 2,
}
