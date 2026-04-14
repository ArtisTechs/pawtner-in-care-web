import styles from './EmptyState.module.css'

interface EmptyStateProps {
  message: string
  title?: string
}

function EmptyState({ message, title = 'Nothing here yet' }: EmptyStateProps) {
  return (
    <div className={styles.root} role="status" aria-live="polite">
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.message}>{message}</p>
    </div>
  )
}

export default EmptyState
