export type CalendarViewMode = 'day' | 'week' | 'month'

export type CalendarEventType =
  | 'adoption'
  | 'awareness'
  | 'community'
  | 'event'
  | 'fundraiser'
  | 'volunteer'

export interface CalendarAttendee {
  id: string
  name: string
  avatarSrc?: string | null
}

export interface CalendarEvent {
  id: string
  source: 'event' | 'volunteer'
  title: string
  description: string
  createdDate?: string | null
  image: string
  link?: string | null
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  totalJoin?: number
  updatedDate?: string | null
  location: string
  organizer: string
  attendees: CalendarAttendee[]
  color: string
  type: CalendarEventType
  isAllDay: boolean
}

export type CalendarViewModeOption = {
  value: CalendarViewMode
  label: string
  disabled?: boolean
}

export type MonthCalendarDayCell = {
  date: Date
  dateKey: string
  day: number
  isCurrentMonth: boolean
}
