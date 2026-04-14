import { FaPlus } from 'react-icons/fa'
import styles from './NewConversationFab.module.css'

interface NewConversationFabProps {
  disabled?: boolean
  onClick: () => void
}

function NewConversationFab({ disabled = false, onClick }: NewConversationFabProps) {
  return (
    <button
      type="button"
      className={styles.fabButton}
      onClick={onClick}
      disabled={disabled}
      aria-label="Create new conversation"
      title="Add chat"
    >
      <span className={styles.fabIcon}>
        <FaPlus aria-hidden="true" />
      </span>
    </button>
  )
}

export default NewConversationFab
