import type { StatCardData, StatIconName } from '@/features/dashboard/types/dashboard'
import type { IconType } from 'react-icons'
import { FaBell, FaHandHoldingUsd } from 'react-icons/fa'
import catIconImage from '@/assets/cat-icon.png'
import dogIconImage from '@/assets/dog-icon.png'
import styles from './StatCard.module.css'

interface StatCardProps {
  card: StatCardData
}

function StatIcon({ name }: { name: StatIconName }) {
  if (name === 'dogs' || name === 'cats') {
    const iconSrc = name === 'cats' ? catIconImage : dogIconImage
    return <img src={iconSrc} alt="" className={styles.animalIconImage} />
  }

  const iconMap: Record<Exclude<StatIconName, 'dogs' | 'cats'>, IconType> = {
    donation: FaHandHoldingUsd,
    reports: FaBell,
  }

  const IconComponent = iconMap[name]
  return <IconComponent />
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
