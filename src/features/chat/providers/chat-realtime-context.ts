import { createContext } from 'react'
import type { ChatRealtimeConnectionState } from '@/features/chat/types/chat-realtime'

interface ChatRealtimeContextValue {
  connectionState: ChatRealtimeConnectionState
  totalUnreadCount: number
}

const DEFAULT_CONNECTION_STATE: ChatRealtimeConnectionState = {
  isConnected: false,
  reconnectAttempt: 0,
  status: 'DISCONNECTED',
}

export const ChatRealtimeContext = createContext<ChatRealtimeContextValue>({
  connectionState: DEFAULT_CONNECTION_STATE,
  totalUnreadCount: 0,
})
