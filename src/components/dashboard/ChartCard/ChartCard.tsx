import type { ChangeEvent, ReactNode } from 'react'
import type { ChartFilterOption, ChartRange } from '../../../types/dashboard'
import styles from './ChartCard.module.css'

interface ChartCardProps {
  title: string
  filterAriaLabel: string
  filterOptions: ChartFilterOption[]
  filterValue: ChartRange
  onFilterChange: (value: ChartRange) => void
  children: ReactNode
}

function ChartCard({
  title,
  filterAriaLabel,
  filterOptions,
  filterValue,
  onFilterChange,
  children,
}: ChartCardProps) {
  const handleFilterChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onFilterChange(event.target.value as ChartRange)
  }

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <label className={styles.filterSelectWrap}>
          <span className={styles.visuallyHidden}>{filterAriaLabel}</span>
          <select
            aria-label={filterAriaLabel}
            className={styles.filterSelect}
            value={filterValue}
            onChange={handleFilterChange}
          >
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <svg viewBox="0 0 18 18" aria-hidden="true" className={styles.chevron}>
            <path
              d="m5.4 7.2 3.6 3.6 3.6-3.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </label>
      </div>

      <div className={styles.chartArea}>{children}</div>
    </section>
  )
}

export default ChartCard
