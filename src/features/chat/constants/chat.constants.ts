import type { InboxFilterKey } from '@/features/chat/types/chat-api'

export const CHAT_LIST_PAGE_SIZE = 12
export const CHAT_MESSAGE_PAGE_SIZE = 30
export const CHAT_MESSAGE_MAX_LENGTH = 255
export const CHAT_INBOX_STALE_TIME_MS = 5 * 60 * 1000

export const CHAT_CONVERSATION_SKELETON_COUNT = 8
export const CHAT_MESSAGE_SKELETON_COUNT = 4

export interface ChatFilterOption {
  key: InboxFilterKey
  label: string
}

export const CHAT_FILTER_OPTIONS: ChatFilterOption[] = [
  { key: 'ALL', label: 'All chats' },
  { key: 'UNREAD', label: 'Unread' },
  { key: 'READ', label: 'Read' },
  { key: 'STARRED', label: 'Starred' },
]
