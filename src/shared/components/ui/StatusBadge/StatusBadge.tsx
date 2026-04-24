import styles from './StatusBadge.module.css'

export type StatusBadgeTone = 'danger' | 'info' | 'neutral' | 'positive' | 'warning'

interface StatusBadgeProps {
  className?: string
  label: string
  title?: string
  tone: StatusBadgeTone
}

function StatusBadge({ className, label, title, tone }: StatusBadgeProps) {
  const classes = [styles.badge, styles[tone], className].filter(Boolean).join(' ')

  return (
    <span className={classes} title={title ?? label}>
      {label}
    </span>
  )
}

export default StatusBadge
