import type { ConversationReadState, MessageReadState } from '@/features/chat/types/chat-api'
import styles from './SeenStatus.module.css'

interface SeenStatusProps {
  readState?: ConversationReadState | MessageReadState
  seenAt?: string | null
}

const LABELS: Record<string, string> = {
  DELIVERED: 'Delivered',
  READ: 'Read',
  SEEN: 'Seen',
  SENT: 'Sent',
  UNREAD: 'Unread',
}

function SeenStatus({ readState, seenAt }: SeenStatusProps) {
  if (!readState && !seenAt) {
    return null
  }

  const readLabel = readState ? LABELS[readState] ?? readState : 'Seen'
  const timestampLabel = seenAt
    ? new Date(seenAt).toLocaleTimeString('en-PH', {
        hour: 'numeric',
        hour12: true,
        minute: '2-digit',
      })
    : ''

  return (
    <span className={styles.status}>
      {readLabel}
      {timestampLabel ? ` at ${timestampLabel}` : ''}
    </span>
  )
}

export default SeenStatus
