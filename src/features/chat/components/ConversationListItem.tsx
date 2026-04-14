import { FaCheckSquare, FaRegSquare, FaRegStar, FaStar } from 'react-icons/fa'
import type { ConversationSummary } from '@/features/chat/types/chat-api'
import SeenStatus from './SeenStatus'
import UnreadBadge from './UnreadBadge'
import styles from './ConversationListItem.module.css'

interface ConversationListItemProps {
  conversation: ConversationSummary
  isMarkedForDelete?: boolean
  isSelected: boolean
  onOpen: (conversationId: string) => void
  onToggleSelectConversation?: (conversationId: string) => void
  onToggleStar: (conversationId: string) => void
}

const formatTimestamp = (value?: string | null) => {
  if (!value) {
    return '--'
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return '--'
  }

  return parsedDate.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    hour12: true,
    minute: '2-digit',
  })
}

function ConversationListItem({
  conversation,
  isMarkedForDelete = false,
  isSelected,
  onOpen,
  onToggleSelectConversation,
  onToggleStar,
}: ConversationListItemProps) {
  const isUnread = conversation.unreadCount > 0 || conversation.readState === 'UNREAD'
  const isRowHighlighted = isSelected || isMarkedForDelete

  return (
    <li>
      <button
        type="button"
        className={`${styles.row} ${isRowHighlighted ? styles.rowSelected : ''}`}
        onClick={() => {
          onOpen(conversation.id)
        }}
      >
        <span
          className={`${styles.selectionIcon} ${isMarkedForDelete ? styles.selectionIconChecked : ''}`}
          role="checkbox"
          tabIndex={0}
          aria-checked={isMarkedForDelete}
          aria-label={isMarkedForDelete ? 'Unselect conversation' : 'Select conversation'}
          onClick={(event) => {
            event.stopPropagation()
            onToggleSelectConversation?.(conversation.id)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              event.stopPropagation()
              onToggleSelectConversation?.(conversation.id)
            }
          }}
        >
          {isMarkedForDelete ? <FaCheckSquare /> : <FaRegSquare />}
        </span>

        <span
          className={styles.starButton}
          role="button"
          tabIndex={0}
          aria-label={conversation.isStarred ? 'Remove star' : 'Add star'}
          onClick={(event) => {
            event.stopPropagation()
            onToggleStar(conversation.id)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onToggleStar(conversation.id)
            }
          }}
        >
          {conversation.isStarred ? <FaStar /> : <FaRegStar />}
        </span>

        <span className={`${styles.participant} ${isUnread ? styles.participantUnread : ''}`}>
          {conversation.participant.displayName}
        </span>

        <span className={styles.preview}>{conversation.lastMessagePreview || 'No messages yet.'}</span>

        <span className={styles.meta}>
          <span className={styles.timestamp}>{formatTimestamp(conversation.lastMessageAt)}</span>
          <UnreadBadge count={conversation.unreadCount} />
          <SeenStatus readState={conversation.readState} seenAt={conversation.lastMessageSeenAt} />
        </span>
      </button>
    </li>
  )
}

export default ConversationListItem
