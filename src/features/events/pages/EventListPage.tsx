import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { FaEdit, FaPlus, FaTimes, FaTrashAlt } from 'react-icons/fa'
import { useLocation, useNavigate } from 'react-router-dom'
import eventFallbackImage from '@/assets/events-icon.png'
import type { AuthSession } from '@/features/auth/types/auth-api'
import {
  DEFAULT_ADD_EVENT_FORM,
  LIST_BATCH_SIZE,
  LIST_INITIAL_BATCH_SIZE,
  LIST_SKELETON_ROW_COUNT,
  type AddEventForm,
} from '@/features/events/constants/event-list.constants'
import { eventService } from '@/features/events/services/event.service'
import type { EventRecord } from '@/features/events/types/event-api'
import { buildEventPayload, mapEventToForm, toTitleCase } from '@/features/events/utils/event-form'
import { defaultHeaderProfile, sidebarBottomItems, sidebarLogo, sidebarMenuItems } from '@/layouts/config/navigation'
import Header from '@/layouts/Header/Header'
import MainLayout from '@/layouts/MainLayout/MainLayout'
import Sidebar from '@/layouts/Sidebar/Sidebar'
import { getErrorMessage } from '@/shared/api/api-error'
import Toast from '@/shared/components/feedback/Toast'
import LocationPickerMap from '@/shared/components/maps/LocationPickerMap/LocationPickerMap'
import PhotoUploadField from '@/shared/components/media/PhotoUploadField/PhotoUploadField'
import ConfirmModal from '@/shared/components/ui/ConfirmModal/ConfirmModal'
import { useHeaderProfile } from '@/shared/hooks/useHeaderProfile'
import { useResponsiveSidebar } from '@/shared/hooks/useResponsiveSidebar'
import { useToast } from '@/shared/hooks/useToast'
import type { SidebarItemKey } from '@/shared/types/layout'
import styles from './EventListPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'events-list'

const normalizeText = (value?: string | null) => value?.trim() || ''

const formatDateLabel = (value?: string | null) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return 'N/A'
  }

  const parsedDate = new Date(normalized.length === 10 ? `${normalized}T00:00:00` : normalized)
  if (Number.isNaN(parsedDate.getTime())) {
    return 'N/A'
  }

  return parsedDate.toLocaleDateString('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const formatTimeLabel = (value?: string | null) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return 'N/A'
  }

  const timeMatch = normalized.match(/^(\d{1,2}):(\d{2})/)
  if (!timeMatch) {
    return normalized
  }

  const date = new Date(2000, 0, 1, Number(timeMatch[1]), Number(timeMatch[2]))
  return date.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    hour12: true,
    minute: '2-digit',
  })
}

const formatScheduleLabel = (eventRecord: EventRecord) => {
  const startLabel = formatDateLabel(eventRecord.startDate)
  const endLabel = formatDateLabel(eventRecord.endDate || eventRecord.startDate)
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`
}

const MAP_PREVIEW_DELTA = 0.008

const buildReadOnlyMapPreviewUrl = (latitude?: number | null, longitude?: number | null) => {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return ''
  }

  const minLongitude = longitude - MAP_PREVIEW_DELTA
  const maxLongitude = longitude + MAP_PREVIEW_DELTA
  const minLatitude = latitude - MAP_PREVIEW_DELTA
  const maxLatitude = latitude + MAP_PREVIEW_DELTA

  const searchParams = new URLSearchParams({
    bbox: `${minLongitude},${minLatitude},${maxLongitude},${maxLatitude}`,
    layer: 'mapnik',
    marker: `${latitude},${longitude}`,
  })

  return `https://www.openstreetmap.org/export/embed.html?${searchParams.toString()}`
}

const resolveStartTimeValue = (eventRecord: EventRecord) => {
  return normalizeText(eventRecord.startTime) || normalizeText(eventRecord.time)
}

const resolveEndTimeValue = (eventRecord: EventRecord) => {
  return (
    normalizeText(eventRecord.endTime) ||
    normalizeText(eventRecord.time) ||
    normalizeText(eventRecord.startTime)
  )
}

const formatTimeRangeLabel = (eventRecord: EventRecord) => {
  const startTimeLabel = formatTimeLabel(resolveStartTimeValue(eventRecord))
  const endTimeLabel = formatTimeLabel(resolveEndTimeValue(eventRecord))

  if (startTimeLabel === 'N/A' && endTimeLabel === 'N/A') {
    return 'N/A'
  }

  if (startTimeLabel === 'N/A') {
    return endTimeLabel
  }

  if (endTimeLabel === 'N/A') {
    return startTimeLabel
  }

  return `${startTimeLabel} - ${endTimeLabel}`
}

const resolveJoinCount = (eventRecord: EventRecord) => {
  const fromList = Array.isArray(eventRecord.joinedUsers) ? eventRecord.joinedUsers.length : 0
  const fromField =
    typeof eventRecord.totalJoin === 'number'
      ? eventRecord.totalJoin
      : typeof eventRecord.totalJoin === 'string'
        ? Number.parseInt(eventRecord.totalJoin, 10) || 0
        : 0
  return Math.max(fromField, fromList)
}

const resolveSortTime = (eventRecord: EventRecord) => {
  const startDate = normalizeText(eventRecord.startDate)
  if (!startDate) {
    return 0
  }

  const time = resolveStartTimeValue(eventRecord) || '00:00'
  const parsedDate = new Date(`${startDate}T${time}:00`)
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime()
}

interface EventListPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

function EventListPage({ onLogout, session }: EventListPageProps) {
  const { clearToast, showToast, toast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchValue, setSearchValue] = useState('')
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const resolvedHeaderProfile = useHeaderProfile({ fallbackProfile: defaultHeaderProfile, session })
  const accessToken = session?.accessToken?.trim() ?? ''

  const [events, setEvents] = useState<EventRecord[]>([])
  const [isLoadingEvents, setIsLoadingEvents] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [viewingEvent, setViewingEvent] = useState<EventRecord | null>(null)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [isSavingEvent, setIsSavingEvent] = useState(false)
  const [eventIdBeingDeleted, setEventIdBeingDeleted] = useState<string | null>(null)
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState<{ id: string; title: string } | null>(null)
  const [addEventForm, setAddEventForm] = useState<AddEventForm>(DEFAULT_ADD_EVENT_FORM)
  const [titleError, setTitleError] = useState('')
  const [startDateError, setStartDateError] = useState('')
  const [endDateError, setEndDateError] = useState('')
  const [startTimeError, setStartTimeError] = useState('')
  const [endTimeError, setEndTimeError] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [visibleEventCount, setVisibleEventCount] = useState(LIST_INITIAL_BATCH_SIZE)
  const tableScrollRef = useRef<HTMLDivElement | null>(null)
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null)

  const loadEvents = useCallback(async () => {
    if (!accessToken) {
      setEvents([])
      return
    }

    setIsLoadingEvents(true)
    try {
      const eventList = await eventService.list(accessToken)
      setEvents([...(Array.isArray(eventList) ? eventList : [])].sort((a, b) => resolveSortTime(b) - resolveSortTime(a)))
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsLoadingEvents(false)
    }
  }, [accessToken, showToast])

  useEffect(() => {
    clearToast()
    void loadEvents()
  }, [clearToast, loadEvents])

  const filteredEvents = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()
    if (!normalizedSearch) {
      return events
    }

    return events.filter((eventRecord) => {
      const haystack = [
        eventRecord.title,
        eventRecord.description,
        eventRecord.startDate,
        eventRecord.endDate,
        eventRecord.startTime,
        eventRecord.endTime,
        eventRecord.time,
        eventRecord.location,
        eventRecord.address,
        eventRecord.link,
        String(resolveJoinCount(eventRecord)),
      ]
        .map((value) => normalizeText(value).toLowerCase())
        .join(' ')

      return haystack.includes(normalizedSearch)
    })
  }, [events, searchValue])

  useEffect(() => {
    setVisibleEventCount(LIST_INITIAL_BATCH_SIZE)
  }, [filteredEvents])

  const visibleEvents = useMemo(() => filteredEvents.slice(0, visibleEventCount), [filteredEvents, visibleEventCount])
  const hasMoreEventsToReveal = visibleEvents.length < filteredEvents.length
  const skeletonRowIndexes = useMemo(() => Array.from({ length: LIST_SKELETON_ROW_COUNT }, (_, index) => index), [])

  useEffect(() => {
    const scrollContainer = tableScrollRef.current
    const triggerElement = loadMoreTriggerRef.current
    if (!scrollContainer || !triggerElement || isLoadingEvents || !hasMoreEventsToReveal) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) {
          return
        }

        setVisibleEventCount((currentCount) => Math.min(currentCount + LIST_BATCH_SIZE, filteredEvents.length))
      },
      { root: scrollContainer, rootMargin: '120px 0px', threshold: 0.05 },
    )

    observer.observe(triggerElement)
    return () => observer.disconnect()
  }, [filteredEvents.length, hasMoreEventsToReveal, isLoadingEvents])

  const closeAddModal = useCallback(() => {
    setIsAddModalOpen(false)
    setEditingEventId(null)
    setAddEventForm(DEFAULT_ADD_EVENT_FORM)
    setTitleError('')
    setStartDateError('')
    setEndDateError('')
    setStartTimeError('')
    setEndTimeError('')
    setPhotoError('')
  }, [])

  const openAddEventModal = useCallback(() => {
    setEditingEventId(null)
    setAddEventForm(DEFAULT_ADD_EVENT_FORM)
    setTitleError('')
    setStartDateError('')
    setEndDateError('')
    setStartTimeError('')
    setEndTimeError('')
    setPhotoError('')
    setIsAddModalOpen(true)
  }, [])

  useEffect(() => {
    const state = location.state as { openAddModal?: boolean } | null
    if (!state?.openAddModal) {
      return
    }

    openAddEventModal()
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate, openAddEventModal])

  const handleAddEventSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!accessToken) {
      showToast('You need to sign in before managing events.', { variant: 'error' })
      return
    }

    const persistEvent = async () => {
      const title = addEventForm.title.trim()
      const startDate = addEventForm.startDate.trim()
      const endDate = addEventForm.endDate.trim()
      const startTime = addEventForm.startTime.trim()
      const endTime = addEventForm.endTime.trim()

      setTitleError('')
      setStartDateError('')
      setEndDateError('')
      setStartTimeError('')
      setEndTimeError('')
      setPhotoError('')

      if (!title || !startDate || !endDate || !startTime || !endTime) {
        if (!title) {
          setTitleError('Title is required.')
        }

        if (!startDate) {
          setStartDateError('Start date is required.')
        }

        if (!endDate) {
          setEndDateError('End date is required.')
        }

        if (!startTime) {
          setStartTimeError('Start time is required.')
        }

        if (!endTime) {
          setEndTimeError('End time is required.')
        }

        showToast('Please complete Title, Start Date, End Date, Start Time, and End Time.', {
          variant: 'error',
        })
        return
      }

      if (endDate < startDate) {
        setEndDateError('End date cannot be earlier than start date.')
        showToast('End date cannot be earlier than start date.', { variant: 'error' })
        return
      }

      if (startDate === endDate && endTime < startTime) {
        setEndTimeError('End time cannot be earlier than start time when dates are the same.')
        showToast('End time cannot be earlier than start time when dates are the same.', {
          variant: 'error',
        })
        return
      }

      if (!addEventForm.photo.trim()) {
        const message = 'Event photo is required.'
        setPhotoError(message)
        showToast(message, { variant: 'error' })
        return
      }

      setIsSavingEvent(true)
      try {
        const payload = buildEventPayload(addEventForm)
        if (editingEventId) {
          await eventService.update(editingEventId, payload, accessToken)
          showToast('Event updated successfully.', { variant: 'success' })
        } else {
          await eventService.create(payload, accessToken)
          showToast('Event added successfully.', { variant: 'success' })
        }

        closeAddModal()
        await loadEvents()
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setIsSavingEvent(false)
      }
    }

    void persistEvent()
  }

  const handleDeleteEvent = (eventId: string) => {
    if (!accessToken) {
      setPendingDeleteEvent(null)
      showToast('You need to sign in before managing events.', { variant: 'error' })
      return
    }

    const deleteEvent = async () => {
      setEventIdBeingDeleted(eventId)
      try {
        await eventService.delete(eventId, accessToken)
        setEvents((currentEvents) => currentEvents.filter((eventRecord) => eventRecord.id !== eventId))
        setViewingEvent((currentEvent) => (currentEvent?.id === eventId ? null : currentEvent))
        showToast('Event removed successfully.', { variant: 'success' })
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setPendingDeleteEvent(null)
        setEventIdBeingDeleted(null)
      }
    }

    void deleteEvent()
  }

  const viewingEventMapUrl = useMemo(
    () => buildReadOnlyMapPreviewUrl(viewingEvent?.latitude, viewingEvent?.long),
    [viewingEvent?.latitude, viewingEvent?.long],
  )

  return (
    <MainLayout
      isSidebarOpen={isSidebarOpen}
      onSidebarClose={() => setIsSidebarOpen(false)}
      header={
        <Header
          profile={resolvedHeaderProfile}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          isMenuOpen={isSidebarOpen}
          onMenuToggle={() => setIsSidebarOpen((prevState) => !prevState)}
        />
      }
      sidebar={
        <Sidebar
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
          <h1 className={styles.pageTitle}>Event List</h1>

          <div className={styles.tablePanel}>
            <div className={styles.tableScroll} ref={tableScrollRef}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Image</th>
                    <th scope="col">Title</th>
                    <th scope="col">Schedule</th>
                    <th scope="col">Time</th>
                    <th scope="col">Total Join</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingEvents ? (
                    skeletonRowIndexes.map((rowIndex) => (
                      <tr key={`event-skeleton-${rowIndex}`} aria-hidden="true">
                        <td><div className={`${styles.skeletonBlock} ${styles.skeletonImage}`} /></td>
                        <td><div className={`${styles.skeletonBlock} ${styles.skeletonTextWide}`} /></td>
                        <td><div className={`${styles.skeletonBlock} ${styles.skeletonTextWide}`} /></td>
                        <td><div className={`${styles.skeletonBlock} ${styles.skeletonText}`} /></td>
                        <td><div className={`${styles.skeletonBlock} ${styles.skeletonText}`} /></td>
                        <td><div className={`${styles.skeletonBlock} ${styles.skeletonAction}`} /></td>
                      </tr>
                    ))
                  ) : filteredEvents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={styles.tableStateCell}>No events found.</td>
                    </tr>
                  ) : (
                    visibleEvents.map((eventRecord) => (
                      <tr key={eventRecord.id} className={styles.clickableRow} onClick={() => setViewingEvent(eventRecord)}>
                        <td>
                          <img src={normalizeText(eventRecord.photo) || eventFallbackImage} alt={eventRecord.title || 'Event'} className={styles.petImage} />
                        </td>
                        <td>{eventRecord.title || 'Untitled Event'}</td>
                        <td>{formatScheduleLabel(eventRecord)}</td>
                        <td>{formatTimeRangeLabel(eventRecord)}</td>
                        <td>{resolveJoinCount(eventRecord)}</td>
                        <td>
                          <div className={styles.actionCell}>
                            <button
                              type="button"
                              className={styles.actionButton}
                              onClick={(event) => {
                                event.stopPropagation()
                                setEditingEventId(eventRecord.id)
                                setAddEventForm(mapEventToForm(eventRecord))
                                setTitleError('')
                                setStartDateError('')
                                setEndDateError('')
                                setStartTimeError('')
                                setEndTimeError('')
                                setPhotoError('')
                                setIsAddModalOpen(true)
                              }}
                            >
                              <FaEdit aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className={`${styles.actionButton} ${styles.deleteButton}`}
                              disabled={eventIdBeingDeleted === eventRecord.id}
                              onClick={(event) => {
                                event.stopPropagation()
                                setPendingDeleteEvent({
                                  id: eventRecord.id,
                                  title: normalizeText(eventRecord.title) || 'this event',
                                })
                              }}
                            >
                              <FaTrashAlt aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {hasMoreEventsToReveal ? <div ref={loadMoreTriggerRef} className={styles.loadMoreTrigger} /> : null}
            </div>

            <button
              type="button"
              className={styles.floatingAddButton}
              aria-label="Add event"
              onClick={openAddEventModal}
            >
              <span className={styles.floatingAddIcon}><FaPlus aria-hidden="true" /></span>
              <span className={styles.floatingAddLabel}>Add Event</span>
            </button>
          </div>

          <footer className={styles.tableFooter}>
            <span className={styles.footerText}>Showing {visibleEvents.length} of {filteredEvents.length}</span>
          </footer>
        </section>
      </div>

      {viewingEvent ? (
        <div className={styles.modalOverlay} onClick={() => setViewingEvent(null)}>
          <div
            className={`${styles.modalCard} ${styles.viewModalCard}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-event-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 id="view-event-modal-title" className={styles.modalTitle}>Event Details</h2>
              <button type="button" className={styles.modalCloseButton} onClick={() => setViewingEvent(null)} aria-label="Close event details modal">
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className={styles.viewModalBody}>
              <div className={styles.viewMedia}>
                <img src={normalizeText(viewingEvent.photo) || eventFallbackImage} alt={viewingEvent.title || 'Event'} className={styles.viewImage} />
              </div>
              <div className={styles.viewDetailsGrid}>
                <div className={styles.viewDetailItem}><span className={styles.viewDetailLabel}>Title</span><span className={styles.viewDetailValue}>{viewingEvent.title || 'N/A'}</span></div>
                <div className={styles.viewDetailItem}><span className={styles.viewDetailLabel}>Start Date</span><span className={styles.viewDetailValue}>{formatDateLabel(viewingEvent.startDate)}</span></div>
                <div className={styles.viewDetailItem}><span className={styles.viewDetailLabel}>End Date</span><span className={styles.viewDetailValue}>{formatDateLabel(viewingEvent.endDate)}</span></div>
                <div className={styles.viewDetailItem}><span className={styles.viewDetailLabel}>Start Time</span><span className={styles.viewDetailValue}>{formatTimeLabel(resolveStartTimeValue(viewingEvent))}</span></div>
                <div className={styles.viewDetailItem}><span className={styles.viewDetailLabel}>End Time</span><span className={styles.viewDetailValue}>{formatTimeLabel(resolveEndTimeValue(viewingEvent))}</span></div>
                <div className={styles.viewDetailItem}><span className={styles.viewDetailLabel}>Location</span><span className={styles.viewDetailValue}>{viewingEvent.location || 'N/A'}</span></div>
                <div className={styles.viewDetailItem}><span className={styles.viewDetailLabel}>Address</span><span className={styles.viewDetailValue}>{viewingEvent.address || 'N/A'}</span></div>
                <div className={styles.viewDetailItem}><span className={styles.viewDetailLabel}>Total Join</span><span className={styles.viewDetailValue}>{resolveJoinCount(viewingEvent)}</span></div>
                <div className={styles.viewDetailItem}><span className={styles.viewDetailLabel}>Created Date</span><span className={styles.viewDetailValue}>{formatDateLabel(viewingEvent.createdDate)}</span></div>
                <div className={styles.viewDetailItem}><span className={styles.viewDetailLabel}>Updated Date</span><span className={styles.viewDetailValue}>{formatDateLabel(viewingEvent.updatedDate)}</span></div>
                <div className={`${styles.viewDetailItem} ${styles.viewDetailItemWide}`}>
                  <span className={styles.viewDetailLabel}>Location Map</span>
                  {viewingEventMapUrl ? (
                    <iframe
                      title={viewingEvent.title ? `${viewingEvent.title} location map` : 'Event location map'}
                      src={viewingEventMapUrl}
                      className={styles.viewMapFrame}
                      loading="lazy"
                    />
                  ) : (
                    <p className={styles.viewDescription}>N/A</p>
                  )}
                </div>
                <div className={`${styles.viewDetailItem} ${styles.viewDetailItemWide}`}><span className={styles.viewDetailLabel}>Link</span><span className={styles.viewDetailValue}>{viewingEvent.link || 'N/A'}</span></div>
                <div className={`${styles.viewDetailItem} ${styles.viewDetailItemWide}`}><span className={styles.viewDetailLabel}>Description</span><p className={styles.viewDescription}>{viewingEvent.description || 'N/A'}</p></div>
              </div>
            </div>

            <div className={`${styles.modalActions} ${styles.viewModalActions}`}>
              <button type="button" className={styles.modalCancelButton} onClick={() => setViewingEvent(null)}>Close</button>
              <button
                type="button"
                className={styles.modalSubmitButton}
                onClick={() => {
                  const eventToEdit = viewingEvent
                  setViewingEvent(null)
                  setEditingEventId(eventToEdit.id)
                  setAddEventForm(mapEventToForm(eventToEdit))
                  setTitleError('')
                  setStartDateError('')
                  setEndDateError('')
                  setStartTimeError('')
                  setEndTimeError('')
                  setPhotoError('')
                  setIsAddModalOpen(true)
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className={`${styles.modalSubmitButton} ${styles.viewDeleteButton}`}
                onClick={() => {
                  setPendingDeleteEvent({
                    id: viewingEvent.id,
                    title: normalizeText(viewingEvent.title) || 'this event',
                  })
                  setViewingEvent(null)
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isAddModalOpen ? (
        <div className={styles.modalOverlay} onClick={closeAddModal}>
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-event-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 id="add-event-modal-title" className={styles.modalTitle}>{editingEventId ? 'Edit Event' : 'Add Event'}</h2>
              <button type="button" className={styles.modalCloseButton} onClick={closeAddModal} aria-label="Close add event modal">
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={handleAddEventSubmit} noValidate>
              <div className={styles.modalFields}>
                <label className={styles.fieldLabel}>
                  <span>
                    Title <span className={styles.requiredAsterisk}>*</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={addEventForm.title}
                    onChange={(event) => {
                      setTitleError('')
                      setAddEventForm((currentForm) => ({ ...currentForm, title: toTitleCase(event.target.value) }))
                    }}
                    className={`${styles.fieldInput}${titleError ? ` ${styles.fieldInputError}` : ''}`}
                  />
                  {titleError ? <span className={styles.fieldErrorText}>{titleError}</span> : null}
                </label>
                <label className={styles.fieldLabel}>
                  <span>
                    Start Time <span className={styles.requiredAsterisk}>*</span>
                  </span>
                  <input
                    type="time"
                    required
                    value={addEventForm.startTime}
                    onChange={(event) => {
                      setStartTimeError('')
                      setEndTimeError('')
                      setAddEventForm((currentForm) => ({ ...currentForm, startTime: event.target.value }))
                    }}
                    className={`${styles.fieldInput}${startTimeError ? ` ${styles.fieldInputError}` : ''}`}
                  />
                  {startTimeError ? <span className={styles.fieldErrorText}>{startTimeError}</span> : null}
                </label>
                <label className={styles.fieldLabel}>
                  <span>
                    End Time <span className={styles.requiredAsterisk}>*</span>
                  </span>
                  <input
                    type="time"
                    required
                    value={addEventForm.endTime}
                    onChange={(event) => {
                      setEndTimeError('')
                      setAddEventForm((currentForm) => ({ ...currentForm, endTime: event.target.value }))
                    }}
                    className={`${styles.fieldInput}${endTimeError ? ` ${styles.fieldInputError}` : ''}`}
                  />
                  {endTimeError ? <span className={styles.fieldErrorText}>{endTimeError}</span> : null}
                </label>
                <label className={styles.fieldLabel}>
                  <span>
                    Start Date <span className={styles.requiredAsterisk}>*</span>
                  </span>
                  <input
                    type="date"
                    required
                    value={addEventForm.startDate}
                    onChange={(event) => {
                      setStartDateError('')
                      setEndDateError('')
                      setEndTimeError('')
                      setAddEventForm((currentForm) => ({ ...currentForm, startDate: event.target.value }))
                    }}
                    className={`${styles.fieldInput}${startDateError ? ` ${styles.fieldInputError}` : ''}`}
                  />
                  {startDateError ? <span className={styles.fieldErrorText}>{startDateError}</span> : null}
                </label>
                <label className={styles.fieldLabel}>
                  <span>
                    End Date <span className={styles.requiredAsterisk}>*</span>
                  </span>
                  <input
                    type="date"
                    required
                    min={addEventForm.startDate || undefined}
                    value={addEventForm.endDate}
                    onChange={(event) => {
                      setEndDateError('')
                      setEndTimeError('')
                      setAddEventForm((currentForm) => ({ ...currentForm, endDate: event.target.value }))
                    }}
                    className={`${styles.fieldInput}${endDateError ? ` ${styles.fieldInputError}` : ''}`}
                  />
                  {endDateError ? <span className={styles.fieldErrorText}>{endDateError}</span> : null}
                </label>
                <label className={`${styles.fieldLabel} ${styles.fieldLabelWide}`}>
                  <span>Location Name</span>
                  <input
                    type="text"
                    value={addEventForm.location}
                    onChange={(event) =>
                      setAddEventForm((currentForm) => ({
                        ...currentForm,
                        location: toTitleCase(event.target.value),
                      }))
                    }
                    className={styles.fieldInput}
                    placeholder="Pawtner Activity Center"
                  />
                </label>
                <div className={`${styles.fieldLabel} ${styles.fieldLabelWide}`}>
                  <span>Address and Map</span>
                  <LocationPickerMap
                    showCoordinateInputs={false}
                    value={{
                      address: addEventForm.address,
                      latitude: addEventForm.latitude,
                      longitude: addEventForm.longitude,
                    }}
                    onChange={(nextLocation) => {
                      setAddEventForm((currentForm) => ({
                        ...currentForm,
                        address: nextLocation.address,
                        latitude: nextLocation.latitude,
                        longitude: nextLocation.longitude,
                      }))
                    }}
                  />
                </div>
                <label className={`${styles.fieldLabel} ${styles.fieldLabelWide}`}><span>Link</span><input type="url" value={addEventForm.link} onChange={(event) => setAddEventForm((currentForm) => ({ ...currentForm, link: event.target.value }))} className={styles.fieldInput} placeholder="https://example.com/events/..." /></label>
                <div className={styles.fieldLabelWide}>
                  <PhotoUploadField
                    value={addEventForm.photo}
                    onChange={(nextPhoto) => {
                      setPhotoError('')
                      setAddEventForm((currentForm) => ({ ...currentForm, photo: nextPhoto }))
                    }}
                    onNotify={(message, variant) => showToast(message, { variant })}
                    required
                    title="Event Photo"
                    subtitle="Upload an event photo from your device or camera. Required."
                    previewAlt={addEventForm.title ? `${addEventForm.title} photo` : 'Event photo preview'}
                    uploadFolder="events"
                  />
                  {photoError ? <span className={styles.fieldErrorText}>{photoError}</span> : null}
                </div>
                <label className={`${styles.fieldLabel} ${styles.fieldLabelWide}`}><span>Description</span><textarea value={addEventForm.description} onChange={(event) => setAddEventForm((currentForm) => ({ ...currentForm, description: event.target.value }))} className={styles.fieldTextarea} style={{ resize: 'none' }} rows={3} /></label>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.modalCancelButton} onClick={closeAddModal}>Cancel</button>
                <button type="submit" className={styles.modalSubmitButton} disabled={isSavingEvent}>{isSavingEvent ? 'Saving...' : editingEventId ? 'Save' : 'Add Event'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={Boolean(pendingDeleteEvent)}
        title="Delete event?"
        message={`Are you sure you want to delete ${pendingDeleteEvent?.title ?? 'this event'}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        ariaLabel="Delete event confirmation"
        isBusy={eventIdBeingDeleted !== null}
        onCancel={() => setPendingDeleteEvent(null)}
        onConfirm={() => {
          if (!pendingDeleteEvent) {
            return
          }

          handleDeleteEvent(pendingDeleteEvent.id)
        }}
      />
    </MainLayout>
  )
}

export default EventListPage
