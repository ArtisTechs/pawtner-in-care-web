import type {
  CalendarViewMode,
  CalendarViewModeOption,
} from '@/features/events-calendar/types/events-calendar'
import styles from './ViewModeSwitcher.module.css'

interface ViewModeSwitcherProps {
  activeMode: CalendarViewMode
  options: CalendarViewModeOption[]
  onModeChange: (mode: CalendarViewMode) => void
}

function ViewModeSwitcher({ activeMode, options, onModeChange }: ViewModeSwitcherProps) {
  return (
    <div className={styles.switcher} role="tablist" aria-label="Calendar view mode">
      {options.map((option) => {
        const isActive = option.value === activeMode

        return (
          <button
            key={option.value}
            type="button"
            className={`${styles.modeButton} ${isActive ? styles.modeButtonActive : ''}`}
            onClick={() => {
              onModeChange(option.value)
            }}
            role="tab"
            aria-selected={isActive}
            disabled={option.disabled}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export default ViewModeSwitcher
