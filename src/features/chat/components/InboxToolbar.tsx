import { FaInfoCircle, FaSearch, FaSyncAlt, FaTrashAlt } from 'react-icons/fa'
import styles from './InboxToolbar.module.css'

interface InboxToolbarProps {
  isRefreshing?: boolean
  onInfoClick?: () => void
  onRefresh: () => void
  onRemoveClick?: () => void
  removeDisabled?: boolean
  searchValue: string
  setSearchValue: (value: string) => void
}

function InboxToolbar({
  isRefreshing = false,
  onInfoClick,
  onRefresh,
  onRemoveClick,
  removeDisabled = false,
  searchValue,
  setSearchValue,
}: InboxToolbarProps) {
  return (
    <div className={styles.root}>
      <label className={styles.searchField}>
        <FaSearch aria-hidden="true" className={styles.searchIcon} />
        <input
          type="search"
          value={searchValue}
          onChange={(event) => {
            setSearchValue(event.target.value)
          }}
          placeholder="Search mail"
          aria-label="Search inbox conversations"
        />
      </label>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.actionButton}
          onClick={onRefresh}
          aria-label="Refresh conversations"
        >
          <FaSyncAlt className={isRefreshing ? styles.spinIcon : ''} aria-hidden="true" />
        </button>

        <button
          type="button"
          className={styles.actionButton}
          onClick={onInfoClick}
          aria-label="Inbox information"
        >
          <FaInfoCircle aria-hidden="true" />
        </button>

        <button
          type="button"
          className={styles.actionButton}
          onClick={onRemoveClick}
          aria-label="Delete selected conversations"
          disabled={removeDisabled}
        >
          <FaTrashAlt aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export default InboxToolbar
