import { FaChevronLeft, FaRegStar, FaStar, FaSyncAlt, FaTrashAlt } from 'react-icons/fa'
import styles from './ChatHeader.module.css'

interface ChatHeaderProps {
  isStarred?: boolean
  onDelete?: () => void
  onFavorite?: () => void
  onBack: () => void
  onRefresh?: () => void
  participantName: string
}

function ChatHeader({
  isStarred = false,
  onDelete,
  onFavorite,
  onBack,
  onRefresh,
  participantName,
}: ChatHeaderProps) {
  return (
    <header className={styles.root}>
      <div className={styles.leftSection}>
        <button
          type="button"
          className={styles.backButton}
          aria-label="Back to inbox"
          onClick={onBack}
        >
          <FaChevronLeft aria-hidden="true" />
        </button>

        <h2 className={styles.title}>{participantName}</h2>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.actionButton}
          aria-label="Refresh conversation"
          onClick={onRefresh}
        >
          <FaSyncAlt aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.actionButton}
          aria-label={isStarred ? 'Unfavorite conversation' : 'Favorite conversation'}
          onClick={onFavorite}
        >
          {isStarred ? <FaStar aria-hidden="true" /> : <FaRegStar aria-hidden="true" />}
        </button>
        <button
          type="button"
          className={styles.actionButton}
          aria-label="Delete conversation"
          onClick={onDelete}
        >
          <FaTrashAlt aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}

export default ChatHeader
