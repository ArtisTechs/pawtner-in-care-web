import { useCallback, useContext, useEffect } from 'react'
import { ChatRealtimeContext } from '@/features/chat/providers/chat-realtime-context'
import { chatRealtimeService } from '@/features/chat/services/chat-realtime.service'
import type { ChatMessage, ConversationSummary, SeenReceipt, UnreadCountSummary } from '@/features/chat/types/chat-api'
import type { ChatSendMessagePayload, ChatSendSeenPayload } from '@/features/chat/types/chat-realtime'

interface UseChatRealtimeOptions {
  enabled?: boolean
  onConversationUpdated?: (conversation: ConversationSummary) => void
  onError?: (error: unknown) => void
  onMessage?: (message: ChatMessage) => void
  onSeenReceipt?: (receipt: SeenReceipt) => void
  onUnreadCount?: (summary: UnreadCountSummary) => void
}

export const useChatRealtime = ({
  enabled = true,
  onConversationUpdated,
  onError,
  onMessage,
  onSeenReceipt,
  onUnreadCount,
}: UseChatRealtimeOptions) => {
  const { connectionState } = useContext(ChatRealtimeContext)

  useEffect(() => {
    if (!enabled) {
      return
    }

    const unsubscribe = chatRealtimeService.subscribe((event) => {
      try {
        if (event.type === 'NEW_MESSAGE') {
          onMessage?.(event.payload)
          return
        }

        if (event.type === 'MESSAGE_SEEN') {
          onSeenReceipt?.(event.payload)
          return
        }

        if (event.type === 'CONVERSATION_UPDATED') {
          onConversationUpdated?.(event.payload)
          return
        }

        onUnreadCount?.(event.payload)
      } catch (error) {
        onError?.(error)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [
    enabled,
    onConversationUpdated,
    onError,
    onMessage,
    onSeenReceipt,
    onUnreadCount,
  ])

  const sendMessage = useCallback((payload: ChatSendMessagePayload) => {
    return chatRealtimeService.sendMessage(payload)
  }, [])

  const sendSeen = useCallback((payload: ChatSendSeenPayload) => {
    return chatRealtimeService.sendSeen(payload)
  }, [])

  return {
    isConnected: connectionState.isConnected,
    connectionStatus: connectionState.status,
    sendMessage,
    sendSeen,
  }
}
