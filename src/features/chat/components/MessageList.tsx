import { useEffect, useMemo, useRef } from 'react'
import { CHAT_MESSAGE_SKELETON_COUNT } from '@/features/chat/constants/chat.constants'
import type { ChatMessage } from '@/features/chat/types/chat-api'
import EmptyState from './EmptyState'
import MessageBubble from './MessageBubble'
import styles from './MessageList.module.css'

const OPTIMISTIC_OUTGOING_ID_PREFIX = 'temp-'

interface MessageListProps {
  errorMessage?: string
  forceScrollToBottomSignal?: number
  hasOlderMessages?: boolean
  isLoading?: boolean
  isLoadingOlder?: boolean
  messages: ChatMessage[]
  onLoadOlder?: () => Promise<void> | void
}

function MessageList({
  errorMessage,
  forceScrollToBottomSignal = 0,
  hasOlderMessages = false,
  isLoading = false,
  isLoadingOlder = false,
  messages,
  onLoadOlder,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const previousMessageCountRef = useRef(0)
  const knownMessageIdsRef = useRef<Set<string>>(new Set())
  const animatedIncomingMessageIdsRef = useRef<Set<string>>(new Set())
  const hasHydratedMessageSetRef = useRef(false)
  const suppressIncomingAnimationRef = useRef(false)
  const canTriggerLoadOlderRef = useRef(true)
  const isLoadingOlderRef = useRef(false)
  const dedupedMessages = useMemo(() => {
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
  }, [messages])
  const latestAnimatedIncomingMessageIds = useMemo(() => {
    const knownMessageIds = knownMessageIdsRef.current
    const nextKnownMessageIds = new Set(dedupedMessages.map((message) => message.id))

    if (dedupedMessages.length === 0) {
      knownMessageIdsRef.current = nextKnownMessageIds
      animatedIncomingMessageIdsRef.current = new Set()
      hasHydratedMessageSetRef.current = false
      return new Set<string>()
    }

    if (!hasHydratedMessageSetRef.current) {
      knownMessageIdsRef.current = nextKnownMessageIds
      hasHydratedMessageSetRef.current = true
      return new Set<string>()
    }

    const nextAnimatedIncomingMessageIds = new Set<string>()
    if (!suppressIncomingAnimationRef.current) {
      dedupedMessages.forEach((message) => {
        if (message.direction !== 'INCOMING') {
          return
        }

        if (knownMessageIds.has(message.id)) {
          return
        }

        nextAnimatedIncomingMessageIds.add(message.id)
      })
    }

    knownMessageIdsRef.current = nextKnownMessageIds

    if (nextAnimatedIncomingMessageIds.size > 0) {
      const animatedIds = animatedIncomingMessageIdsRef.current
      nextAnimatedIncomingMessageIds.forEach((id) => {
        animatedIds.add(id)
      })
    }

    return nextAnimatedIncomingMessageIds
  }, [dedupedMessages])

  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) {
      previousMessageCountRef.current = dedupedMessages.length
      return
    }

    const previousCount = previousMessageCountRef.current
    const nextCount = dedupedMessages.length

    if (nextCount === 0) {
      previousMessageCountRef.current = 0
      return
    }

    const distanceFromBottom =
      scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight

    if (previousCount === 0 || distanceFromBottom < 120) {
      scrollElement.scrollTop = scrollElement.scrollHeight
    }

    previousMessageCountRef.current = nextCount
  }, [dedupedMessages])

  useEffect(() => {
    isLoadingOlderRef.current = isLoadingOlder
  }, [isLoadingOlder])

  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) {
      return
    }

    scrollElement.scrollTop = scrollElement.scrollHeight
    canTriggerLoadOlderRef.current = true
  }, [forceScrollToBottomSignal])

  const handleLoadOlder = async () => {
    if (!onLoadOlder || isLoadingOlder) {
      return
    }

    suppressIncomingAnimationRef.current = true

    const scrollElement = scrollRef.current
    try {
      if (!scrollElement) {
        await onLoadOlder()
        return
      }

      const previousHeight = scrollElement.scrollHeight
      const previousTop = scrollElement.scrollTop

      await onLoadOlder()

      requestAnimationFrame(() => {
        const nextHeight = scrollElement.scrollHeight
        scrollElement.scrollTop = Math.max(0, nextHeight - previousHeight + previousTop)
      })
    } finally {
      suppressIncomingAnimationRef.current = false
    }
  }

  if (isLoading) {
    return (
      <div className={styles.scrollArea} aria-label="Loading conversation messages">
        <div className={`${styles.list} ${styles.skeletonList}`}>
          {Array.from({ length: CHAT_MESSAGE_SKELETON_COUNT }).map((_, index) => {
            const isOutgoing = index % 2 === 0

            return (
              <div
                key={`message-skeleton-${index}`}
                className={`${styles.skeletonRow} ${isOutgoing ? styles.skeletonRowOutgoing : styles.skeletonRowIncoming}`}
                aria-hidden="true"
              >
                <div className={`${styles.skeletonBubble} ${isOutgoing ? styles.skeletonBubbleOutgoing : styles.skeletonBubbleIncoming}`}>
                  <span className={styles.skeletonLine} />
                  <span className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className={styles.stateArea}>
        <EmptyState title="Unable to load chat" message={errorMessage} />
      </div>
    )
  }

  if (dedupedMessages.length === 0) {
    return (
      <div className={styles.stateArea}>
        <EmptyState title="No messages yet" message="Start this conversation by sending a message." />
      </div>
    )
  }

  const latestOutgoingMessageId =
    [...dedupedMessages].reverse().find((message) => message.direction === 'OUTGOING')?.id ?? null

  const handleScroll = () => {
    const scrollElement = scrollRef.current
    if (!scrollElement || !onLoadOlder || !hasOlderMessages) {
      return
    }

    if (scrollElement.scrollTop > 140) {
      canTriggerLoadOlderRef.current = true
      return
    }

    if (scrollElement.scrollTop <= 80 && canTriggerLoadOlderRef.current && !isLoadingOlderRef.current) {
      canTriggerLoadOlderRef.current = false
      void handleLoadOlder()
    }
  }

  return (
    <div className={styles.scrollArea} ref={scrollRef} onScroll={handleScroll}>
      {hasOlderMessages || isLoadingOlder ? (
        <div className={styles.loadOlderWrap} aria-live="polite">
          {isLoadingOlder ? <span className={styles.loadingOlderText}>Loading older messages...</span> : null}
        </div>
      ) : null}

      <div className={styles.list}>
        {dedupedMessages.map((message) => (
          <MessageBubble
            key={message.id}
            animateOnEnter={
              latestAnimatedIncomingMessageIds.has(message.id) ||
              animatedIncomingMessageIdsRef.current.has(message.id) ||
              (message.direction === 'OUTGOING' && message.id.startsWith(OPTIMISTIC_OUTGOING_ID_PREFIX))
            }
            message={message}
            showSeenStatus={message.id === latestOutgoingMessageId}
          />
        ))}
      </div>
    </div>
  )
}

export default MessageList
