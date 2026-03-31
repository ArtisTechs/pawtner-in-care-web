import type { StatCardData, StatIconName } from '../../../types/dashboard'
import styles from './StatCard.module.css'

interface StatCardProps {
  card: StatCardData
}

function StatIcon({ name }: { name: StatIconName }) {
  switch (name) {
    case 'dogs':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M8 7.5a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2Zm8 0a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2Zm-4 2.4c-2.8 0-5.1 2.2-5.1 4.8 0 2.6 2 4.8 4.5 4.8h1.2c2.5 0 4.5-2.2 4.5-4.8 0-2.6-2.3-4.8-5.1-4.8Zm-6.3 5.4H4.8a1.3 1.3 0 0 1-1.3-1.3v-1.2c0-.7.6-1.3 1.3-1.3h1.5M18.3 11.5h.9c.7 0 1.3.6 1.3 1.3V14c0 .7-.6 1.3-1.3 1.3h-1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'cats':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 5.6 9.4 3.8l-2 2.7v5.6c0 3 2 5.4 4.6 5.4s4.6-2.4 4.6-5.4V6.5l-2-2.7L12 5.6Zm-2 7.6h.01m4 0h.01M9.5 15c.8.8 1.8 1.2 2.5 1.2.8 0 1.8-.4 2.5-1.2M5.5 10.8h1.9m9.2 0h1.9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'donation':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 4.5v15m-4.1-3c.9.7 2.4 1.1 4.1 1.1 2.5 0 4.5-1 4.5-2.3 0-3.8-8.6-1.7-8.6-5.5 0-1.3 2-2.3 4.5-2.3 1.7 0 3.2.4 4.1 1M4.5 8.2h2.2M17.3 8.2h2.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'reports':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M8 4.5h8l3 3v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2Zm8 0v3h3M10 12h6M10 15.5h6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    default:
      return null
  }
}

function StatCard({ card }: StatCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.topRow}>
        <div>
          <p className={styles.title}>{card.title}</p>
          <h2 className={styles.value}>{card.value}</h2>
        </div>

        <span className={styles.iconBox} aria-hidden="true">
          <StatIcon name={card.icon} />
        </span>
      </div>
    </article>
  )
}

export default StatCard
