import { useCallback, useEffect, useMemo, useState } from 'react'
import { FaPlus, FaTimes } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'
import { APP_ROUTES } from '@/app/routes/route-paths'
import eventFallbackImage from '@/assets/events-icon.png'
import volunteerFallbackImage from '@/assets/volunteer-icon.png'
import type { AuthSession } from '@/features/auth/types/auth-api'
import CalendarToolbar from '@/features/events-calendar/components/CalendarToolbar/CalendarToolbar'
import MonthCalendarGrid from '@/features/events-calendar/components/MonthCalendarGrid/MonthCalendarGrid'
import { CALENDAR_VIEW_MODE_OPTIONS } from '@/features/events-calendar/constants/events-calendar.constants'
import { eventService } from '@/features/events/services/event.service'
import type { EventRecord } from '@/features/events/types/event-api'
import type { CalendarEvent, CalendarViewMode } from '@/features/events-calendar/types/events-calendar'
import { volunteerService } from '@/features/volunteers/services/volunteer.service'
import type { VolunteerRecord } from '@/features/volunteers/types/volunteer-api'
import {
  addDays,
  addMonths,
  formatCalendarPeriodLabel,
  isDateWithinRange,
  parseDateKey,
  toDateKeyFromDate,
  toMonthEnd,
  toMonthStart,
  toWeekEnd,
  toWeekStart,
} from '@/features/events-calendar/utils/events-calendar'
import { defaultHeaderProfile, sidebarBottomItems, sidebarLogo, sidebarMenuItems } from '@/layouts/config/navigation'
import Header from '@/layouts/Header/Header'
import MainLayout from '@/layouts/MainLayout/MainLayout'
import Sidebar from '@/layouts/Sidebar/Sidebar'
import { getErrorMessage } from '@/shared/api/api-error'
import Toast from '@/shared/components/feedback/Toast'
import { useHeaderProfile } from '@/shared/hooks/useHeaderProfile'
import { useResponsiveSidebar } from '@/shared/hooks/useResponsiveSidebar'
import { useToast } from '@/shared/hooks/useToast'
import type { SidebarItemKey } from '@/shared/types/layout'
import styles from './EventsCalendarPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'calendar'

interface EventsCalendarPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

const EVENT_COLOR = '#d8e6ff'
const VOLUNTEER_COLOR = '#fde5cf'

const normalizeText = (value?: string | null) => value?.trim() ?? ''

const normalizeTimeValue = (value?: string | null, fallback = '00:00') => {
  const normalizedValue = normalizeText(value)
  const match = normalizedValue.match(/^(\d{1,2}):(\d{2})/)
  if (!match) {
    return fallback
  }

  const hour = Number.parseInt(match[1], 10)
  const minute = Number.parseInt(match[2], 10)
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour > 23 || minute > 59) {
    return fallback
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

const formatDateLabel = (value?: string | null) => {
  if (!value) {
    return 'N/A'
  }

  const parsedDate = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsedDate.getTime())) {
    return 'N/A'
  }

  return parsedDate.toLocaleDateString('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const formatDateTimeLabel = (value?: string | null) => {
  const normalizedValue = normalizeText(value)
  if (!normalizedValue) {
    return 'N/A'
  }

  const parsedDate = new Date(normalizedValue)
  if (Number.isNaN(parsedDate.getTime())) {
    return 'N/A'
  }

  return parsedDate.toLocaleString('en-PH', {
    day: '2-digit',
    hour: 'numeric',
    hour12: true,
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const formatTimeLabel = (value: string) => {
  const timeMatch = value.match(/^(\d{1,2}):(\d{2})/)
  if (!timeMatch) {
    return value
  }

  const date = new Date(2000, 0, 1, Number(timeMatch[1]), Number(timeMatch[2]))
  return date.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    hour12: true,
    minute: '2-digit',
  })
}

const formatTimeRangeLabel = (event: CalendarEvent) => {
  if (event.isAllDay) {
    return 'All day'
  }

  const startTimeLabel = formatTimeLabel(event.startTime)
  const endTimeLabel = formatTimeLabel(event.endTime)
  return startTimeLabel === endTimeLabel ? startTimeLabel : `${startTimeLabel} - ${endTimeLabel}`
}

const formatJoinedUsersLabel = (event: CalendarEvent) => {
  if (!event.attendees.length) {
    return 'N/A'
  }

  return event.attendees.map((attendee) => attendee.name).join(', ')
}

const resolveJoinCount = (value: number | string | null | undefined, joinedUsersCount: number) => {
  const parsedFromField =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10) || 0
        : 0

  return Math.max(parsedFromField, joinedUsersCount)
}

const toFullName = (
  firstName?: string | null,
  middleName?: string | null,
  lastName?: string | null,
  fallback = 'Participant',
) => {
  const fullName = [firstName, middleName, lastName]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(' ')
    .trim()

  return fullName || fallback
}

const mapEventRecordToCalendarEvent = (record: EventRecord): CalendarEvent | null => {
  const startDate = normalizeText(record.startDate)
  const endDate = normalizeText(record.endDate) || startDate
  if (!startDate || !endDate) {
    return null
  }

  const startTime = normalizeTimeValue(record.startTime ?? record.time, '00:00')
  const endTime = normalizeTimeValue(record.endTime, startTime)
  const location = normalizeText(record.location) || normalizeText(record.address) || 'Event'
  const attendees = Array.isArray(record.joinedUsers)
    ? record.joinedUsers.map((joinedUser) => ({
        avatarSrc: normalizeText(joinedUser.profilePicture) || null,
        id: joinedUser.id,
        name: toFullName(joinedUser.firstName, joinedUser.middleName, joinedUser.lastName, 'Event Participant'),
      }))
    : []

  return {
    attendees,
    color: EVENT_COLOR,
    createdDate: record.createdDate ?? null,
    description: normalizeText(record.description),
    endDate,
    endTime,
    id: `event:${record.id}`,
    image: normalizeText(record.photo) || eventFallbackImage,
    isAllDay:
      !normalizeText(record.startTime) &&
      !normalizeText(record.endTime) &&
      !normalizeText(record.time),
    link: normalizeText(record.link) || null,
    location,
    organizer: 'Event Team',
    source: 'event',
    startDate,
    startTime,
    title: normalizeText(record.title) || 'Untitled Event',
    totalJoin: resolveJoinCount(record.totalJoin, attendees.length),
    type: 'event',
    updatedDate: record.updatedDate ?? null,
  }
}

const mapVolunteerRecordToCalendarEvent = (record: VolunteerRecord): CalendarEvent | null => {
  const startDate = normalizeText(record.startDate)
  const endDate = normalizeText(record.endDate) || startDate
  if (!startDate || !endDate) {
    return null
  }

  const startTime = normalizeTimeValue(record.startTime, '00:00')
  const endTime = normalizeTimeValue(record.endTime, startTime)
  const attendees = Array.isArray(record.joinedUsers)
    ? record.joinedUsers.map((joinedUser) => ({
        avatarSrc: normalizeText(joinedUser.profilePicture) || null,
        id: joinedUser.id,
        name: toFullName(
          joinedUser.firstName,
          joinedUser.middleName,
          joinedUser.lastName,
          'Volunteer Participant',
        ),
      }))
    : []

  return {
    attendees,
    color: VOLUNTEER_COLOR,
    createdDate: record.createdDate ?? null,
    description: normalizeText(record.description),
    endDate,
    endTime,
    id: `volunteer:${record.id}`,
    image: normalizeText(record.photo) || volunteerFallbackImage,
    isAllDay: false,
    link: normalizeText(record.link) || null,
    location: 'Volunteer',
    organizer: 'Volunteer Team',
    source: 'volunteer',
    startDate,
    startTime,
    title: normalizeText(record.title) || 'Untitled Volunteer',
    totalJoin: resolveJoinCount(record.totalJoin, attendees.length),
    type: 'volunteer',
    updatedDate: record.updatedDate ?? null,
  }
}

const sortCalendarEvents = (leftEvent: CalendarEvent, rightEvent: CalendarEvent) => {
  const leftStart = `${leftEvent.startDate}T${leftEvent.startTime}`
  const rightStart = `${rightEvent.startDate}T${rightEvent.startTime}`
  const startCompare = leftStart.localeCompare(rightStart)
  if (startCompare !== 0) {
    return startCompare
  }

  return leftEvent.title.localeCompare(rightEvent.title)
}

function EventsCalendarPage({ onLogout, session }: EventsCalendarPageProps) {
  const { clearToast, showToast, toast } = useToast()
  const navigate = useNavigate()
  const [searchValue, setSearchValue] = useState('')
  const [selectedMode, setSelectedMode] = useState<CalendarViewMode>('month')
  const [anchorDate, setAnchorDate] = useState(() => new Date())
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(() => toDateKeyFromDate(new Date()))
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false)
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false)
  const [viewingCalendarEvent, setViewingCalendarEvent] = useState<CalendarEvent | null>(null)
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const resolvedHeaderProfile = useHeaderProfile({
    fallbackProfile: defaultHeaderProfile,
    session,
  })
  const accessToken = session?.accessToken?.trim() ?? ''

  useEffect(() => {
    clearToast()
  }, [clearToast])

  const periodRange = useMemo(() => {
    if (selectedMode === 'day') {
      return {
        endDate: anchorDate,
        startDate: anchorDate,
      }
    }

    if (selectedMode === 'week') {
      const startDate = toWeekStart(anchorDate)
      return {
        endDate: toWeekEnd(anchorDate),
        startDate,
      }
    }

    const startDate = toMonthStart(anchorDate)
    return {
      endDate: toMonthEnd(startDate),
      startDate,
    }
  }, [anchorDate, selectedMode])

  const periodStartKey = useMemo(() => toDateKeyFromDate(periodRange.startDate), [periodRange.startDate])
  const periodEndKey = useMemo(() => toDateKeyFromDate(periodRange.endDate), [periodRange.endDate])

  const loadCalendarData = useCallback(async () => {
    if (!accessToken) {
      setCalendarEvents([])
      return
    }

    setIsLoadingCalendar(true)
    try {
      if (selectedMode === 'day') {
        const [eventRecords, volunteerRecords] = await Promise.all([
          eventService.listByDate(periodStartKey, accessToken),
          volunteerService.listByDate(periodStartKey, accessToken),
        ])

        const mappedEvents = eventRecords
          .map(mapEventRecordToCalendarEvent)
          .filter((value): value is CalendarEvent => Boolean(value))
        const mappedVolunteers = volunteerRecords
          .map(mapVolunteerRecordToCalendarEvent)
          .filter((value): value is CalendarEvent => Boolean(value))

        setCalendarEvents([...mappedEvents, ...mappedVolunteers].sort(sortCalendarEvents))
        return
      }

      const rangeQuery = {
        endDateFrom: periodStartKey,
        startDateTo: periodEndKey,
      }
      const [eventRecords, volunteerRecords] = await Promise.all([
        eventService.listByDateRange(rangeQuery, accessToken),
        volunteerService.listByDateRange(rangeQuery, accessToken),
      ])

      const mappedEvents = eventRecords
        .map(mapEventRecordToCalendarEvent)
        .filter((value): value is CalendarEvent => Boolean(value))
      const mappedVolunteers = volunteerRecords
        .map(mapVolunteerRecordToCalendarEvent)
        .filter((value): value is CalendarEvent => Boolean(value))

      setCalendarEvents([...mappedEvents, ...mappedVolunteers].sort(sortCalendarEvents))
    } catch (error) {
      setCalendarEvents([])
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsLoadingCalendar(false)
    }
  }, [accessToken, periodEndKey, periodStartKey, selectedMode, showToast])

  useEffect(() => {
    void loadCalendarData()
  }, [loadCalendarData])

  const resolvedSelectedDateKey = useMemo(() => {
    if (!selectedDateKey) {
      return periodStartKey
    }

    return isDateWithinRange(selectedDateKey, periodStartKey, periodEndKey)
      ? selectedDateKey
      : periodStartKey
  }, [periodEndKey, periodStartKey, selectedDateKey])

  const periodEvents = useMemo(() => {
    return calendarEvents.filter((event) => event.endDate >= periodStartKey && event.startDate <= periodEndKey)
  }, [calendarEvents, periodEndKey, periodStartKey])

  const searchableEvents = useMemo(() => {
    const normalizedSearchValue = searchValue.trim().toLowerCase()

    if (!normalizedSearchValue) {
      return periodEvents
    }

    return periodEvents.filter((event) => {
      return (
        event.title.toLowerCase().includes(normalizedSearchValue) ||
        event.description.toLowerCase().includes(normalizedSearchValue) ||
        event.source.toLowerCase().includes(normalizedSearchValue) ||
        event.type.toLowerCase().includes(normalizedSearchValue)
      )
    })
  }, [periodEvents, searchValue])

  const handleViewModeChange = (nextMode: CalendarViewMode) => {
    if (nextMode === selectedMode) {
      return
    }

    const activeDate = parseDateKey(resolvedSelectedDateKey)
    setAnchorDate(activeDate)
    setSelectedDateKey(toDateKeyFromDate(activeDate))
    setSelectedMode(nextMode)
  }

  const handleSelectDate = (dateKey: string) => {
    setSelectedDateKey(dateKey)
    setAnchorDate(parseDateKey(dateKey))
  }

  const handleOpenEventDetails = useCallback((event: CalendarEvent) => {
    setViewingCalendarEvent(event)
  }, [])

  const navigateToAddEvent = () => {
    setIsFabMenuOpen(false)
    navigate(APP_ROUTES.eventList, {
      state: { openAddModal: true },
    })
  }

  const navigateToAddVolunteer = () => {
    setIsFabMenuOpen(false)
    navigate(APP_ROUTES.volunteerList, {
      state: { openAddModal: true },
    })
  }

  return (
    <MainLayout
      isSidebarOpen={isSidebarOpen}
      onSidebarClose={() => {
        setIsSidebarOpen(false)
      }}
      header={
        <Header
          profile={resolvedHeaderProfile}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          isMenuOpen={isSidebarOpen}
          onMenuToggle={() => {
            setIsSidebarOpen((prevState) => !prevState)
          }}
        />
      }
      sidebar={
        <Sidebar
          session={session}
          activeItem={ACTIVE_MENU_ITEM}
          logoSrc={sidebarLogo}
          menuItems={sidebarMenuItems}
          bottomItems={sidebarBottomItems}
          onLogout={onLogout}
        />
      }
    >
      <Toast toast={toast} onClose={clearToast} />

      <div className={styles.page}>
        <section className={styles.container}>
          <h1 className={styles.pageTitle}>Calendar</h1>

          <section className={styles.calendarColumn} aria-label="Calendar panel">
            <div className={styles.calendarCard}>
              <CalendarToolbar
                periodLabel={formatCalendarPeriodLabel(selectedMode, anchorDate)}
                modeOptions={CALENDAR_VIEW_MODE_OPTIONS}
                selectedMode={selectedMode}
                onModeChange={handleViewModeChange}
                onPrevPeriod={() => {
                  setAnchorDate((currentDate) => {
                    if (selectedMode === 'day') {
                      return addDays(currentDate, -1)
                    }

                    if (selectedMode === 'week') {
                      return addDays(currentDate, -7)
                    }

                    return addMonths(currentDate, -1)
                  })
                }}
                onNextPeriod={() => {
                  setAnchorDate((currentDate) => {
                    if (selectedMode === 'day') {
                      return addDays(currentDate, 1)
                    }

                    if (selectedMode === 'week') {
                      return addDays(currentDate, 7)
                    }

                    return addMonths(currentDate, 1)
                  })
                }}
              />

              {isLoadingCalendar ? (
                <p className={styles.stateMessage}>Loading events and volunteers...</p>
              ) : searchableEvents.length === 0 ? (
                <p className={styles.stateMessage}>No events or volunteers found for this period.</p>
              ) : null}

              <MonthCalendarGrid
                events={searchableEvents}
                anchorDate={anchorDate}
                selectedDateKey={resolvedSelectedDateKey}
                viewMode={selectedMode}
                onOpenEventDetails={handleOpenEventDetails}
                onSelectDate={handleSelectDate}
              />
            </div>
          </section>
        </section>

        <div className={styles.fabContainer}>
          <div className={`${styles.fabMenu} ${isFabMenuOpen ? styles.fabMenuOpen : ''}`}>
            <button type="button" className={styles.fabOptionButton} onClick={navigateToAddEvent}>
              Add Event
            </button>
            <button type="button" className={styles.fabOptionButton} onClick={navigateToAddVolunteer}>
              Add Volunteer
            </button>
          </div>

          <button
            type="button"
            className={styles.fabButton}
            aria-label="Open add options"
            aria-expanded={isFabMenuOpen}
            onClick={() => {
              setIsFabMenuOpen((prevState) => !prevState)
            }}
          >
            <FaPlus className={isFabMenuOpen ? styles.fabIconOpen : ''} aria-hidden="true" />
          </button>
        </div>

        {isFabMenuOpen ? (
          <button
            type="button"
            aria-label="Close add options"
            className={styles.fabBackdrop}
            onClick={() => {
              setIsFabMenuOpen(false)
            }}
          />
        ) : null}

        {viewingCalendarEvent ? (
          <div
            className={styles.modalOverlay}
            onClick={() => {
              setViewingCalendarEvent(null)
            }}
          >
            <div
              className={`${styles.modalCard} ${styles.viewModalCard}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="view-calendar-item-modal-title"
              onClick={(mouseEvent) => {
                mouseEvent.stopPropagation()
              }}
            >
              <div className={styles.modalHeader}>
                <h2 id="view-calendar-item-modal-title" className={styles.modalTitle}>
                  {viewingCalendarEvent.source === 'event' ? 'Event Details' : 'Volunteer Details'}
                </h2>
                <button
                  type="button"
                  className={styles.modalCloseButton}
                  onClick={() => {
                    setViewingCalendarEvent(null)
                  }}
                  aria-label="Close details modal"
                >
                  <FaTimes aria-hidden="true" />
                </button>
              </div>

              <div className={styles.viewModalBody}>
                <div className={styles.viewMedia}>
                  <img
                    src={viewingCalendarEvent.image}
                    alt={viewingCalendarEvent.title}
                    className={styles.viewImage}
                  />
                </div>
                <div className={styles.viewDetailsGrid}>
                  <div className={styles.viewDetailItem}>
                    <span className={styles.viewDetailLabel}>Title</span>
                    <span className={styles.viewDetailValue}>{viewingCalendarEvent.title}</span>
                  </div>
                  <div className={styles.viewDetailItem}>
                    <span className={styles.viewDetailLabel}>Type</span>
                    <span className={styles.viewDetailValue}>
                      {viewingCalendarEvent.source === 'event' ? 'Event' : 'Volunteer'}
                    </span>
                  </div>
                  <div className={styles.viewDetailItem}>
                    <span className={styles.viewDetailLabel}>Start Date</span>
                    <span className={styles.viewDetailValue}>
                      {formatDateLabel(viewingCalendarEvent.startDate)}
                    </span>
                  </div>
                  <div className={styles.viewDetailItem}>
                    <span className={styles.viewDetailLabel}>End Date</span>
                    <span className={styles.viewDetailValue}>
                      {formatDateLabel(viewingCalendarEvent.endDate)}
                    </span>
                  </div>
                  <div className={styles.viewDetailItem}>
                    <span className={styles.viewDetailLabel}>
                      {viewingCalendarEvent.source === 'event' ? 'Time' : 'Schedule Time'}
                    </span>
                    <span className={styles.viewDetailValue}>
                      {formatTimeRangeLabel(viewingCalendarEvent)}
                    </span>
                  </div>
                  <div className={styles.viewDetailItem}>
                    <span className={styles.viewDetailLabel}>Total Join</span>
                    <span className={styles.viewDetailValue}>
                      {viewingCalendarEvent.totalJoin ?? viewingCalendarEvent.attendees.length}
                    </span>
                  </div>
                  <div className={styles.viewDetailItem}>
                    <span className={styles.viewDetailLabel}>Created Date</span>
                    <span className={styles.viewDetailValue}>
                      {formatDateTimeLabel(viewingCalendarEvent.createdDate)}
                    </span>
                  </div>
                  <div className={styles.viewDetailItem}>
                    <span className={styles.viewDetailLabel}>Updated Date</span>
                    <span className={styles.viewDetailValue}>
                      {formatDateTimeLabel(viewingCalendarEvent.updatedDate)}
                    </span>
                  </div>
                  <div className={`${styles.viewDetailItem} ${styles.viewDetailItemWide}`}>
                    <span className={styles.viewDetailLabel}>Link</span>
                    {viewingCalendarEvent.link ? (
                      <a
                        href={viewingCalendarEvent.link}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.viewDetailValue}
                      >
                        {viewingCalendarEvent.link}
                      </a>
                    ) : (
                      <span className={styles.viewDetailValue}>N/A</span>
                    )}
                  </div>
                  <div className={`${styles.viewDetailItem} ${styles.viewDetailItemWide}`}>
                    <span className={styles.viewDetailLabel}>Joined Users</span>
                    <p className={styles.viewDescription}>{formatJoinedUsersLabel(viewingCalendarEvent)}</p>
                  </div>
                  <div className={`${styles.viewDetailItem} ${styles.viewDetailItemWide}`}>
                    <span className={styles.viewDetailLabel}>Description</span>
                    <p className={styles.viewDescription}>
                      {viewingCalendarEvent.description || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.modalCancelButton}
                  onClick={() => {
                    setViewingCalendarEvent(null)
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </MainLayout>
  )
}

export default EventsCalendarPage



