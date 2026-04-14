import type { ChatMessage, ConversationSummary, SeenReceipt, UnreadCountSummary } from '@/features/chat/types/chat-api'

export type ChatRealtimeEvent =
  | {
      type: 'CONVERSATION_UPDATED'
      payload: ConversationSummary
    }
  | {
      type: 'NEW_MESSAGE'
      payload: ChatMessage
    }
  | {
      type: 'MESSAGE_SEEN'
      payload: SeenReceipt
    }
  | {
      type: 'UNREAD_COUNT_UPDATED'
      payload: UnreadCountSummary
    }

export type ChatRealtimeEventType = ChatRealtimeEvent['type']

export type ChatRealtimeConnectionStatus = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED'

export interface ChatRealtimeConnectionState {
  isConnected: boolean
  reconnectAttempt: number
  status: ChatRealtimeConnectionStatus
}

export interface ChatSendMessagePayload {
  content: string
  conversationId: string
}

export interface ChatSendSeenPayload {
  conversationId: string
}
