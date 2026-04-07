import { FaChevronLeft, FaChevronRight } from 'react-icons/fa'
import ViewModeSwitcher from '@/features/events-calendar/components/ViewModeSwitcher/ViewModeSwitcher'
import type {
  CalendarViewMode,
  CalendarViewModeOption,
} from '@/features/events-calendar/types/events-calendar'
import styles from './CalendarToolbar.module.css'

interface CalendarToolbarProps {
  periodLabel: string
  modeOptions: CalendarViewModeOption[]
  selectedMode: CalendarViewMode
  onModeChange: (mode: CalendarViewMode) => void
  onNextPeriod: () => void
  onPrevPeriod: () => void
}

function CalendarToolbar({
  periodLabel,
  modeOptions,
  selectedMode,
  onModeChange,
  onNextPeriod,
  onPrevPeriod,
}: CalendarToolbarProps) {
  return (
    <header className={styles.toolbar}>
      <p className={styles.todayLabel}>Today</p>

      <div className={styles.monthNav}>
        <button
          type="button"
          className={styles.monthNavButton}
          onClick={onPrevPeriod}
          aria-label="Previous period"
        >
          <FaChevronLeft aria-hidden="true" />
        </button>

        <h2 className={styles.monthLabel}>{periodLabel}</h2>

        <button
          type="button"
          className={styles.monthNavButton}
          onClick={onNextPeriod}
          aria-label="Next period"
        >
          <FaChevronRight aria-hidden="true" />
        </button>
      </div>

      <ViewModeSwitcher activeMode={selectedMode} options={modeOptions} onModeChange={onModeChange} />
    </header>
  )
}

export default CalendarToolbar
