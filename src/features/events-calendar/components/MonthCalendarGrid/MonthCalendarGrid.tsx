import { useMemo, type CSSProperties } from 'react'
import CalendarEventChip from '@/features/events-calendar/components/CalendarEventChip/CalendarEventChip'
import { CALENDAR_WEEKDAY_LABELS } from '@/features/events-calendar/constants/events-calendar.constants'
import type { CalendarEvent, CalendarViewMode } from '@/features/events-calendar/types/events-calendar'
import {
  createDayCalendarGrid,
  createMonthCalendarGrid,
  createWeekCalendarGrid,
  getEventsForDate,
  toWeekStart,
  toMonthStart,
} from '@/features/events-calendar/utils/events-calendar'
import styles from './MonthCalendarGrid.module.css'

interface MonthCalendarGridProps {
  events: CalendarEvent[]
  anchorDate: Date
  selectedDateKey: string | null
  viewMode: CalendarViewMode
  onOpenEventDetails: (event: CalendarEvent) => void
  onSelectDate: (dateKey: string) => void
}

function MonthCalendarGrid({
  events,
  anchorDate,
  selectedDateKey,
  viewMode,
  onOpenEventDetails,
  onSelectDate,
}: MonthCalendarGridProps) {
  const dateCells = useMemo(() => {
    if (viewMode === 'day') {
      return createDayCalendarGrid(anchorDate)
    }

    if (viewMode === 'week') {
      return createWeekCalendarGrid(toWeekStart(anchorDate))
    }

    return createMonthCalendarGrid(toMonthStart(anchorDate))
  }, [anchorDate, viewMode])

  const weekdayLabels = useMemo(() => {
    if (viewMode === 'day') {
      return [
        anchorDate.toLocaleDateString('en-PH', {
          weekday: 'short',
        }),
      ]
    }

    return [...CALENDAR_WEEKDAY_LABELS]
  }, [anchorDate, viewMode])

  const columnCount = viewMode === 'day' ? 1 : 7

  return (
    <section className={styles.calendar} aria-label={`${viewMode} calendar`}>
      <div className={styles.weekdays} style={{ '--calendar-column-count': columnCount } as CSSProperties}>
        {weekdayLabels.map((weekdayLabel) => (
          <span key={weekdayLabel} className={styles.weekdayCell}>
            {weekdayLabel}
          </span>
        ))}
      </div>

      <div
        className={`${styles.grid} ${viewMode === 'day' ? styles.gridSingleColumn : ''}`}
        style={{ '--calendar-column-count': columnCount } as CSSProperties}
      >
        {dateCells.map((dateCell) => {
          const eventsForDate = getEventsForDate(events, dateCell.dateKey)
          const visibleEventChips = eventsForDate.slice(0, 2)
          const hiddenChipCount = Math.max(0, eventsForDate.length - visibleEventChips.length)
          const isSelected = selectedDateKey === dateCell.dateKey

          return (
            <button
              key={dateCell.dateKey}
              type="button"
              className={`${styles.dayCell} ${
                dateCell.isCurrentMonth ? '' : styles.dayCellOutsideMonth
              } ${isSelected ? styles.dayCellSelected : ''} ${
                viewMode === 'day' ? styles.dayCellSingleColumn : ''
              }`}
              onClick={() => {
                onSelectDate(dateCell.dateKey)
              }}
            >
              <span className={styles.dayNumber}>{dateCell.day}</span>

              <div className={styles.eventsStack}>
                {visibleEventChips.map((event) => (
                  <CalendarEventChip
                    key={`${dateCell.dateKey}-${event.id}`}
                    event={event}
                    onOpenDetails={onOpenEventDetails}
                  />
                ))}

                {hiddenChipCount > 0 ? (
                  <span className={styles.moreBadge}>+{hiddenChipCount} more</span>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default MonthCalendarGrid
