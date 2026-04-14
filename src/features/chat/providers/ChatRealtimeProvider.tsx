import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { getAuthSessionUserId } from '@/features/auth/utils/auth-utils'
import { ChatRealtimeContext } from '@/features/chat/providers/chat-realtime-context'
import { chatService } from '@/features/chat/services/chat.service'
import { chatRealtimeService } from '@/features/chat/services/chat-realtime.service'
import type { ChatRealtimeConnectionState } from '@/features/chat/types/chat-realtime'

interface ChatRealtimeProviderProps extends PropsWithChildren {
  session?: AuthSession | null
}

function ChatRealtimeProvider({ children, session }: ChatRealtimeProviderProps) {
  const [connectionState, setConnectionState] = useState<ChatRealtimeConnectionState>(
    chatRealtimeService.getConnectionState(),
  )
  const [totalUnreadCount, setTotalUnreadCount] = useState(0)
  const latestAccessTokenRef = useRef('')

  const accessToken = session?.accessToken?.trim() ?? ''
  const userId = getAuthSessionUserId(session?.user)

  const syncUnreadCount = useCallback(async (token: string) => {
    if (!token) {
      setTotalUnreadCount(0)
      return
    }

    try {
      const summary = await chatService.getUnreadCount(token)
      if (token !== latestAccessTokenRef.current) {
        return
      }
      setTotalUnreadCount(summary.totalUnreadCount)
    } catch {
      // Keep existing value and wait for the next successful sync.
    }
  }, [])

  useEffect(() => {
    latestAccessTokenRef.current = accessToken
  }, [accessToken])

  useEffect(() => {
    const unsubscribe = chatRealtimeService.subscribeConnection((nextState) => {
      setConnectionState(nextState)
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (accessToken && userId) {
      chatRealtimeService.startSession({
        token: accessToken,
        userId,
      })
      return
    }

    chatRealtimeService.stopSession()
  }, [accessToken, userId])

  useEffect(() => {
    if (!accessToken) {
      setTotalUnreadCount(0)
      return
    }

    void syncUnreadCount(accessToken)
  }, [accessToken, syncUnreadCount])

  useEffect(() => {
    if (!accessToken) {
      return
    }

    const unsubscribe = chatRealtimeService.subscribe((event) => {
      if (event.type === 'UNREAD_COUNT_UPDATED') {
        setTotalUnreadCount(event.payload.totalUnreadCount)
        return
      }

      if (event.type === 'NEW_MESSAGE') {
        if (event.payload.direction === 'INCOMING') {
          void syncUnreadCount(accessToken)
        }
        return
      }

      if (event.type === 'MESSAGE_SEEN' || event.type === 'CONVERSATION_UPDATED') {
        void syncUnreadCount(accessToken)
      }
    })

    return unsubscribe
  }, [accessToken, syncUnreadCount])

  const contextValue = useMemo(
    () => ({
      connectionState,
      totalUnreadCount,
    }),
    [connectionState, totalUnreadCount],
  )

  return (
    <ChatRealtimeContext.Provider value={contextValue}>
      {children}
    </ChatRealtimeContext.Provider>
  )
}

export default ChatRealtimeProvider
