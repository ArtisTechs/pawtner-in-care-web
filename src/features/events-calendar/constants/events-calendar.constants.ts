import type { CalendarViewModeOption } from '@/features/events-calendar/types/events-calendar'

export const CALENDAR_WEEKDAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const

export const CALENDAR_VIEW_MODE_OPTIONS: CalendarViewModeOption[] = [
  {
    value: 'day',
    label: 'Day',
  },
  {
    value: 'week',
    label: 'Week',
  },
  {
    value: 'month',
    label: 'Month',
  },
]
