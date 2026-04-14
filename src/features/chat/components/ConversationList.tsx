import type { ConversationSummary } from '@/features/chat/types/chat-api'
import ConversationListItem from './ConversationListItem'
import EmptyState from './EmptyState'
import LoadingState from './LoadingState'
import styles from './ConversationList.module.css'

interface ConversationListProps {
  conversations: ConversationSummary[]
  errorMessage?: string
  isLoading?: boolean
  onOpen: (conversationId: string) => void
  onToggleSelectConversation?: (conversationId: string) => void
  onToggleStar: (conversationId: string) => void
  selectedConversationIds?: string[]
  selectedConversationId?: string
}

function ConversationList({
  conversations,
  errorMessage,
  isLoading = false,
  onOpen,
  onToggleSelectConversation,
  onToggleStar,
  selectedConversationIds = [],
  selectedConversationId,
}: ConversationListProps) {
  if (isLoading) {
    return <LoadingState message="Loading conversations..." />
  }

  if (errorMessage) {
    return <EmptyState title="Unable to load inbox" message={errorMessage} />
  }

  if (conversations.length === 0) {
    return <EmptyState title="Inbox is empty" message="No conversations match your current filters." />
  }

  return (
    <ul className={styles.list}>
      {conversations.map((conversation) => (
        <ConversationListItem
          key={conversation.id}
          conversation={conversation}
          isMarkedForDelete={selectedConversationIds.includes(conversation.id)}
          isSelected={selectedConversationId === conversation.id}
          onOpen={onOpen}
          onToggleSelectConversation={onToggleSelectConversation}
          onToggleStar={onToggleStar}
        />
      ))}
    </ul>
  )
}

export default ConversationList
