import type { CSSProperties } from 'react'
import type { CalendarEvent } from '@/features/events-calendar/types/events-calendar'
import { formatEventScheduleLabel } from '@/features/events-calendar/utils/events-calendar'
import styles from './CalendarEventChip.module.css'

interface CalendarEventChipProps {
  event: CalendarEvent
  onOpenDetails: (event: CalendarEvent) => void
}

const MAX_VISIBLE_ATTENDEES = 4

const getInitials = (value: string) => {
  const segments = value
    .split(' ')
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (segments.length === 0) {
    return '?'
  }

  if (segments.length === 1) {
    return segments[0][0]?.toUpperCase() ?? '?'
  }

  return `${segments[0][0] ?? ''}${segments[1][0] ?? ''}`.toUpperCase()
}

function CalendarEventChip({ event, onOpenDetails }: CalendarEventChipProps) {
  const visibleAttendees = event.attendees.slice(0, MAX_VISIBLE_ATTENDEES)
  const hiddenAttendeeCount = Math.max(0, event.attendees.length - MAX_VISIBLE_ATTENDEES)

  return (
    <span
      className={styles.container}
      role="button"
      tabIndex={0}
      aria-label={`Open ${event.title} details`}
      onMouseDown={(mouseEvent) => {
        mouseEvent.preventDefault()
        mouseEvent.stopPropagation()
      }}
      onClick={(mouseEvent) => {
        mouseEvent.preventDefault()
        mouseEvent.stopPropagation()
        onOpenDetails(event)
      }}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key !== 'Enter' && keyboardEvent.key !== ' ') {
          return
        }

        keyboardEvent.preventDefault()
        keyboardEvent.stopPropagation()
        onOpenDetails(event)
      }}
    >
      <span
        className={styles.chip}
        style={{ '--calendar-chip-color': event.color } as CSSProperties}
        title={event.title}
      >
        {event.title}
      </span>

      <article className={styles.hoverCard} aria-label={`${event.title} details`}>
        <img src={event.image} alt={event.title} className={styles.coverImage} loading="lazy" />
        <div className={styles.cardBody}>
          <h4 className={styles.title}>{event.title}</h4>
          <p className={styles.meta}>{formatEventScheduleLabel(event)}</p>
          <p className={styles.meta}>{event.source === 'event' ? 'Event' : 'Volunteer'}</p>
          <p className={styles.description}>{event.description || 'No additional details provided.'}</p>

          {visibleAttendees.length > 0 ? (
            <div className={styles.attendees} aria-label={`${event.attendees.length} attendees`}>
              {visibleAttendees.map((attendee, attendeeIndex) => (
                <span
                  key={attendee.id}
                  className={styles.attendeeAvatar}
                  style={{ zIndex: MAX_VISIBLE_ATTENDEES - attendeeIndex }}
                  title={attendee.name}
                >
                  {attendee.avatarSrc ? (
                    <img src={attendee.avatarSrc} alt={attendee.name} loading="lazy" />
                  ) : (
                    <span>{getInitials(attendee.name)}</span>
                  )}
                </span>
              ))}

              {hiddenAttendeeCount > 0 ? (
                <span className={styles.attendeeOverflow} title={`${hiddenAttendeeCount} more attendees`}>
                  +{hiddenAttendeeCount}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </article>
    </span>
  )
}

export default CalendarEventChip
