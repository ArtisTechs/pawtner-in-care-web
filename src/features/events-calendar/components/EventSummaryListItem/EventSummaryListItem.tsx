import type { CalendarEvent } from '@/features/events-calendar/types/events-calendar'
import { formatEventScheduleLabel } from '@/features/events-calendar/utils/events-calendar'
import styles from './EventSummaryListItem.module.css'

interface EventSummaryListItemProps {
  event: CalendarEvent
  isSelected: boolean
  onSelect: (eventId: string) => void
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

function EventSummaryListItem({ event, isSelected, onSelect }: EventSummaryListItemProps) {
  const visibleAttendees = event.attendees.slice(0, MAX_VISIBLE_ATTENDEES)
  const hiddenAttendeeCount = Math.max(0, event.attendees.length - MAX_VISIBLE_ATTENDEES)

  return (
    <button
      type="button"
      className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
      onClick={() => {
        onSelect(event.id)
      }}
      aria-pressed={isSelected}
    >
      <div className={styles.header}>
        <img src={event.image} alt={event.title} className={styles.image} loading="lazy" />
        <h3 className={styles.title}>{event.title}</h3>
      </div>

      <p className={styles.meta}>{formatEventScheduleLabel(event)}</p>
      <p className={styles.meta}>{event.location}</p>
      <p className={styles.meta}>{event.organizer}</p>

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
    </button>
  )
}

export default EventSummaryListItem
