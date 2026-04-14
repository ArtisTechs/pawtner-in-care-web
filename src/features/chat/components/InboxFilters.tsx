import type { IconType } from 'react-icons'
import {
  FaEnvelope,
  FaEnvelopeOpen,
  FaInbox,
  FaStar,
} from 'react-icons/fa'
import type { ChatFilterOption } from '@/features/chat/constants/chat.constants'
import type { InboxFilterKey } from '@/features/chat/types/chat-api'
import styles from './InboxFilters.module.css'

interface InboxFiltersProps {
  activeFilter: InboxFilterKey
  onSelect: (filter: InboxFilterKey) => void
  options: ChatFilterOption[]
  unreadCount?: number
}

const FILTER_ICON_MAP: Record<InboxFilterKey, IconType> = {
  ALL: FaInbox,
  READ: FaEnvelopeOpen,
  UNREAD: FaEnvelope,
  STARRED: FaStar,
}

function InboxFilters({ activeFilter, onSelect, options, unreadCount = 0 }: InboxFiltersProps) {
  return (
    <div className={styles.root} role="tablist" aria-label="Conversation filters">
      {options.map((option) => {
        const isActive = option.key === activeFilter
        const showCount = option.key === 'UNREAD' && unreadCount > 0
        const Icon = FILTER_ICON_MAP[option.key]

        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`${styles.filterButton} ${isActive ? styles.filterButtonActive : ''}`}
            onClick={() => {
              onSelect(option.key)
            }}
          >
            <span className={styles.icon} aria-hidden="true">
              <Icon />
            </span>
            <span>{option.label}</span>
            {showCount ? <span className={styles.count}>{unreadCount}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

export default InboxFilters
