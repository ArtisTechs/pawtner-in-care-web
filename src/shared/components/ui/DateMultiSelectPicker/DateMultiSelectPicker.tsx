import { useEffect, useMemo, useRef, useState } from 'react'
import { FaChevronDown, FaChevronLeft, FaChevronRight } from 'react-icons/fa'
import styles from './DateMultiSelectPicker.module.css'

type CalendarDayCell = {
  date: Date
  dateKey: string
  day: number
  hasLogs: boolean
  isCurrentMonth: boolean
}

interface DateMultiSelectPickerProps {
  availableDateKeys: string[]
  onApply: (dateKeys: string[]) => void
  placeholder?: string
  selectedDateKeys: string[]
}

const formatDateLabel = (value?: string | null) => {
  if (!value) {
    return 'N/A'
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return 'N/A'
  }

  return parsedDate.toLocaleDateString('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const parseDateKey = (dateKey: string) => {
  return new Date(`${dateKey}T00:00:00`)
}

const toDateKeyFromDate = (value: Date) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const toMonthStart = (value: Date) => {
  return new Date(value.getFullYear(), value.getMonth(), 1)
}

const addMonths = (value: Date, offset: number) => {
  return new Date(value.getFullYear(), value.getMonth() + offset, 1)
}

const createCalendarGrid = (monthStart: Date, availableDateKeys: Set<string>): CalendarDayCell[] => {
  const startDayOfWeek = monthStart.getDay()
  const gridStartDate = new Date(monthStart)
  gridStartDate.setDate(monthStart.getDate() - startDayOfWeek)

  return Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(gridStartDate)
    cellDate.setDate(gridStartDate.getDate() + index)
    const dateKey = toDateKeyFromDate(cellDate)

    return {
      date: cellDate,
      dateKey,
      day: cellDate.getDate(),
      hasLogs: availableDateKeys.has(dateKey),
      isCurrentMonth: cellDate.getMonth() === monthStart.getMonth(),
    }
  })
}

function DateMultiSelectPicker({
  availableDateKeys,
  onApply,
  placeholder = 'Select Date',
  selectedDateKeys,
}: DateMultiSelectPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [draftDateKeys, setDraftDateKeys] = useState<string[]>(selectedDateKeys)
  const [calendarMonth, setCalendarMonth] = useState(() => toMonthStart(new Date()))
  const pickerRef = useRef<HTMLDivElement | null>(null)

  const availableDateKeySet = useMemo(() => new Set(availableDateKeys), [availableDateKeys])

  useEffect(() => {
    setDraftDateKeys(selectedDateKeys)
  }, [selectedDateKeys])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleDocumentPointerDown = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentPointerDown)

    return () => {
      document.removeEventListener('mousedown', handleDocumentPointerDown)
    }
  }, [isOpen])

  const calendarMonthLabel = useMemo(
    () =>
      calendarMonth.toLocaleDateString('en-PH', {
        month: 'long',
        year: 'numeric',
      }),
    [calendarMonth],
  )

  const calendarDayCells = useMemo(
    () => createCalendarGrid(calendarMonth, availableDateKeySet),
    [availableDateKeySet, calendarMonth],
  )

  const selectedDateLabel = useMemo(() => {
    if (selectedDateKeys.length === 0) {
      return placeholder
    }

    if (selectedDateKeys.length === 1) {
      return formatDateLabel(selectedDateKeys[0])
    }

    return `${selectedDateKeys.length} Dates Selected`
  }, [placeholder, selectedDateKeys])

  const handleOpen = () => {
    setIsOpen(true)
    setDraftDateKeys(selectedDateKeys)

    const initialDateKey = selectedDateKeys[0] ?? availableDateKeys[0]
    if (initialDateKey) {
      setCalendarMonth(toMonthStart(parseDateKey(initialDateKey)))
    }
  }

  const handleToggleDraftDate = (dateKey: string) => {
    setDraftDateKeys((currentDraftDateKeys) => {
      if (currentDraftDateKeys.includes(dateKey)) {
        return currentDraftDateKeys.filter((value) => value !== dateKey)
      }

      return [...currentDraftDateKeys, dateKey].sort((left, right) => right.localeCompare(left))
    })
  }

  return (
    <div className={styles.root} ref={pickerRef}>
      <button type="button" className={styles.trigger} onClick={handleOpen}>
        <span>{selectedDateLabel}</span>
        <FaChevronDown aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className={styles.panel}>
          <div className={styles.header}>
            <h3>{calendarMonthLabel}</h3>
            <div className={styles.navButtons}>
              <button
                type="button"
                className={styles.navButton}
                onClick={() => {
                  setCalendarMonth((currentMonth) => addMonths(currentMonth, -1))
                }}
                aria-label="Previous month"
              >
                <FaChevronLeft aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.navButton}
                onClick={() => {
                  setCalendarMonth((currentMonth) => addMonths(currentMonth, 1))
                }}
                aria-label="Next month"
              >
                <FaChevronRight aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className={styles.weekdays}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((weekday, index) => (
              <span key={`${weekday}-${index}`}>{weekday}</span>
            ))}
          </div>

          <div className={styles.grid}>
            {calendarDayCells.map((cell) => {
              const isSelected = draftDateKeys.includes(cell.dateKey)

              return (
                <button
                  key={cell.date.toISOString()}
                  type="button"
                  className={`${styles.dayButton}${
                    !cell.isCurrentMonth ? ` ${styles.dayOutsideMonth}` : ''
                  }${isSelected ? ` ${styles.daySelected}` : ''}${
                    cell.hasLogs ? ` ${styles.dayHasLogs}` : ''
                  }`}
                  onClick={() => {
                    handleToggleDraftDate(cell.dateKey)
                  }}
                >
                  {cell.day}
                </button>
              )
            })}
          </div>

          <p className={styles.hint}>*You can choose multiple date</p>

          <button
            type="button"
            className={styles.applyButton}
            onClick={() => {
              onApply(draftDateKeys)
              setIsOpen(false)
            }}
          >
            Apply Now
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default DateMultiSelectPicker
