import styles from './UnreadBadge.module.css'

interface UnreadBadgeProps {
  count: number
}

function UnreadBadge({ count }: UnreadBadgeProps) {
  if (count <= 0) {
    return null
  }

  return <span className={styles.badge}>{count > 99 ? '99+' : count}</span>
}

export default UnreadBadge
