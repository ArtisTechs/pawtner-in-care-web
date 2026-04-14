import { FaChevronLeft, FaChevronRight } from 'react-icons/fa'
import styles from './InboxPagination.module.css'

interface InboxPaginationProps {
  currentPage: number
  pageSize: number
  totalElements: number
  onNext: () => void
  onPrev: () => void
}

function InboxPagination({ currentPage, pageSize, totalElements, onNext, onPrev }: InboxPaginationProps) {
  const startIndex = totalElements === 0 ? 0 : currentPage * pageSize + 1
  const endIndex = Math.min(totalElements, (currentPage + 1) * pageSize)
  const hasPrev = currentPage > 0
  const hasNext = endIndex < totalElements

  return (
    <footer className={styles.root}>
      <span className={styles.summary}>
        Showing {startIndex}-{endIndex} of {totalElements.toLocaleString('en-US')}
      </span>

      <div className={styles.controls}>
        <button type="button" onClick={onPrev} disabled={!hasPrev} aria-label="Previous page">
          <FaChevronLeft aria-hidden="true" />
        </button>
        <button type="button" onClick={onNext} disabled={!hasNext} aria-label="Next page">
          <FaChevronRight aria-hidden="true" />
        </button>
      </div>
    </footer>
  )
}

export default InboxPagination
