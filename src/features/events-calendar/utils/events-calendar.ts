import type {
  CalendarEvent,
  CalendarViewMode,
  MonthCalendarDayCell,
} from '@/features/events-calendar/types/events-calendar'

const MONDAY_INDEX = 1
const SUNDAY_INDEX = 0

export const parseDateKey = (dateKey: string) => {
  return new Date(`${dateKey}T00:00:00`)
}

export const toDateKeyFromDate = (value: Date) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const toMonthStart = (value: Date) => {
  return new Date(value.getFullYear(), value.getMonth(), 1)
}

export const addMonths = (value: Date, offset: number) => {
  return new Date(value.getFullYear(), value.getMonth() + offset, 1)
}

export const addDays = (value: Date, offset: number) => {
  const nextValue = new Date(value)
  nextValue.setDate(nextValue.getDate() + offset)
  return nextValue
}

export const toMonthEnd = (monthStart: Date) => {
  return new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
}

export const toWeekStart = (value: Date) => {
  const normalizedDate = new Date(value.getFullYear(), value.getMonth(), value.getDate())
  const dayIndex = normalizedDate.getDay()
  const offsetFromMonday = dayIndex === SUNDAY_INDEX ? -6 : MONDAY_INDEX - dayIndex
  normalizedDate.setDate(normalizedDate.getDate() + offsetFromMonday)
  return normalizedDate
}

export const toWeekEnd = (value: Date) => {
  const weekStart = toWeekStart(value)
  return addDays(weekStart, 6)
}

const toMondayIndex = (dayIndex: number) => {
  if (dayIndex === SUNDAY_INDEX) {
    return 6
  }

  return dayIndex - MONDAY_INDEX
}

export const formatMonthYearLabel = (value: Date) => {
  return value.toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
  })
}

export const formatDateRangeLabel = (rangeStart: Date, rangeEnd: Date) => {
  const startLabel = rangeStart.toLocaleDateString('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const endLabel = rangeEnd.toLocaleDateString('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`
}

export const formatCalendarPeriodLabel = (mode: CalendarViewMode, anchorDate: Date) => {
  if (mode === 'day') {
    return formatDateRangeLabel(anchorDate, anchorDate)
  }

  if (mode === 'week') {
    const weekStart = toWeekStart(anchorDate)
    const weekEnd = toWeekEnd(anchorDate)
    return formatDateRangeLabel(weekStart, weekEnd)
  }

  return formatMonthYearLabel(anchorDate)
}

export const formatCalendarDateLabel = (dateKey: string) => {
  return parseDateKey(dateKey).toLocaleDateString('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const formatTimeLabel = (value: string) => {
  const [hourString, minuteString] = value.split(':')
  const parsedHour = Number.parseInt(hourString, 10)
  const parsedMinute = Number.parseInt(minuteString, 10)

  if (Number.isNaN(parsedHour) || Number.isNaN(parsedMinute)) {
    return value
  }

  const normalizedHour = parsedHour % 12 || 12
  const period = parsedHour >= 12 ? 'PM' : 'AM'
  return `${normalizedHour}:${String(parsedMinute).padStart(2, '0')} ${period}`
}

export const formatEventScheduleLabel = (event: CalendarEvent) => {
  const startDateLabel = formatCalendarDateLabel(event.startDate)
  const endDateLabel = formatCalendarDateLabel(event.endDate)

  if (event.isAllDay) {
    if (event.startDate === event.endDate) {
      return `${startDateLabel} - All day`
    }

    return `${startDateLabel} - ${endDateLabel} - All day`
  }

  const startTimeLabel = formatTimeLabel(event.startTime)
  const endTimeLabel = formatTimeLabel(event.endTime)

  if (event.startDate === event.endDate) {
    return `${startDateLabel} - ${startTimeLabel} - ${endTimeLabel}`
  }

  return `${startDateLabel} ${startTimeLabel} - ${endDateLabel} ${endTimeLabel}`
}

export const createMonthCalendarGrid = (monthStart: Date): MonthCalendarDayCell[] => {
  const firstDayOffset = toMondayIndex(monthStart.getDay())
  const gridStartDate = new Date(monthStart)
  gridStartDate.setDate(monthStart.getDate() - firstDayOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(gridStartDate)
    cellDate.setDate(gridStartDate.getDate() + index)
    const dateKey = toDateKeyFromDate(cellDate)

    return {
      date: cellDate,
      dateKey,
      day: cellDate.getDate(),
      isCurrentMonth: cellDate.getMonth() === monthStart.getMonth(),
    }
  })
}

export const createWeekCalendarGrid = (weekStart: Date): MonthCalendarDayCell[] => {
  return Array.from({ length: 7 }, (_, index) => {
    const cellDate = addDays(weekStart, index)
    return {
      date: cellDate,
      dateKey: toDateKeyFromDate(cellDate),
      day: cellDate.getDate(),
      isCurrentMonth: true,
    }
  })
}

export const createDayCalendarGrid = (dayDate: Date): MonthCalendarDayCell[] => {
  const normalizedDay = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate())
  return [
    {
      date: normalizedDay,
      dateKey: toDateKeyFromDate(normalizedDay),
      day: normalizedDay.getDate(),
      isCurrentMonth: true,
    },
  ]
}

export const isDateWithinRange = (dateKey: string, startDate: string, endDate: string) => {
  return dateKey >= startDate && dateKey <= endDate
}

export const getEventsForDate = (events: CalendarEvent[], dateKey: string) => {
  return events
    .filter((event) => isDateWithinRange(dateKey, event.startDate, event.endDate))
    .sort((leftEvent, rightEvent) => {
      const dateCompare = leftEvent.startDate.localeCompare(rightEvent.startDate)
      if (dateCompare !== 0) {
        return dateCompare
      }

      return leftEvent.startTime.localeCompare(rightEvent.startTime)
    })
}

export const doesEventIntersectMonth = (event: CalendarEvent, monthStart: Date) => {
  const monthStartKey = toDateKeyFromDate(monthStart)
  const monthEndKey = toDateKeyFromDate(toMonthEnd(monthStart))
  return event.endDate >= monthStartKey && event.startDate <= monthEndKey
}
