import type { CalendarEvent } from '@/features/events-calendar/types/events-calendar'
import EventSummaryListItem from '@/features/events-calendar/components/EventSummaryListItem/EventSummaryListItem'
import styles from './EventsSidebarPanel.module.css'

interface EventsSidebarPanelProps {
  events: CalendarEvent[]
  selectedEventId: string | null
  onAddNewEvent: () => void
  onSeeMore: () => void
  onSelectEvent: (eventId: string) => void
}

function EventsSidebarPanel({
  events,
  selectedEventId,
  onAddNewEvent,
  onSeeMore,
  onSelectEvent,
}: EventsSidebarPanelProps) {
  return (
    <section className={styles.card} aria-label="Event summary panel">
      <button type="button" className={styles.addButton} onClick={onAddNewEvent}>
        + Add New Event
      </button>

      <h2 className={styles.sectionTitle}>You are going to</h2>

      <div className={styles.list} role="list">
        {events.length === 0 ? (
          <p className={styles.emptyState}>No events scheduled for this period.</p>
        ) : (
          events.map((event) => (
            <EventSummaryListItem
              key={event.id}
              event={event}
              isSelected={selectedEventId === event.id}
              onSelect={onSelectEvent}
            />
          ))
        )}
      </div>

      <button type="button" className={styles.seeMoreButton} onClick={onSeeMore}>
        See More
      </button>
    </section>
  )
}

export default EventsSidebarPanel
