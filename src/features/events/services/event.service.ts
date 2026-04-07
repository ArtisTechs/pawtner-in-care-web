import type { EventPayload, EventRecord } from '@/features/events/types/event-api'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

type EventListResponse = EventRecord[] | { content?: EventRecord[] | null }
type EventListSortDir = 'asc' | 'desc'
type EventListQuery = {
  date?: string
  endDateFrom?: string
  endDateTo?: string
  endTimeFrom?: string
  endTimeTo?: string
  ignorePagination?: boolean
  page?: number
  search?: string
  size?: number
  sortBy?: string
  sortDir?: EventListSortDir
  startDateFrom?: string
  startDateTo?: string
  startTimeFrom?: string
  startTimeTo?: string
  title?: string
}
type EventDateRangeQuery = Pick<EventListQuery, 'endDateFrom' | 'endDateTo' | 'startDateFrom' | 'startDateTo'>

const inFlightEventListRequests = new Map<string, Promise<EventRecord[]>>()

const normalizeEventListResponse = (value: EventListResponse) => {
  if (Array.isArray(value)) {
    return value
  }

  if (value && Array.isArray(value.content)) {
    return value.content
  }

  return []
}

const buildListQueryString = (query?: EventListQuery) => {
  if (!query) {
    return ''
  }

  const params = new URLSearchParams()
  const appendIfPresent = (key: string, value?: string | number | boolean) => {
    if (value === undefined || value === null || value === '') {
      return
    }

    params.set(key, String(value))
  }

  appendIfPresent('search', query.search)
  appendIfPresent('title', query.title)
  appendIfPresent('date', query.date)
  appendIfPresent('startDateFrom', query.startDateFrom)
  appendIfPresent('startDateTo', query.startDateTo)
  appendIfPresent('endDateFrom', query.endDateFrom)
  appendIfPresent('endDateTo', query.endDateTo)
  appendIfPresent('startTimeFrom', query.startTimeFrom)
  appendIfPresent('startTimeTo', query.startTimeTo)
  appendIfPresent('endTimeFrom', query.endTimeFrom)
  appendIfPresent('endTimeTo', query.endTimeTo)
  appendIfPresent('page', query.page)
  appendIfPresent('size', query.size)
  appendIfPresent('sortBy', query.sortBy)
  appendIfPresent('sortDir', query.sortDir)
  appendIfPresent('ignorePagination', query.ignorePagination)

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}

const listEvents = (token: string, query?: EventListQuery) => {
  const queryString = buildListQueryString(query)
  const requestKey = `${token}:${queryString}`
  const cachedRequest = inFlightEventListRequests.get(requestKey)
  if (cachedRequest) {
    return cachedRequest
  }

  const request = apiClient
    .get<EventListResponse>(`${API_ENDPOINTS.events.base}${queryString}`, { token })
    .then(normalizeEventListResponse)

  inFlightEventListRequests.set(requestKey, request)

  void request.finally(() => {
    inFlightEventListRequests.delete(requestKey)
  })

  return request
}

const listEventsByDate = (date: string, token: string) => {
  return listEvents(token, {
    date,
    ignorePagination: true,
  })
}

const listEventsByDateRange = (rangeQuery: EventDateRangeQuery, token: string) => {
  return listEvents(token, {
    ...rangeQuery,
    ignorePagination: true,
  })
}

export const eventService = {
  create: (payload: EventPayload, token: string) =>
    apiClient.post<EventRecord, EventPayload>(API_ENDPOINTS.events.base, payload, { token }),
  delete: (eventId: string, token: string) =>
    apiClient.delete<null>(API_ENDPOINTS.events.byId(eventId), { token }),
  getOne: (eventId: string, token: string) =>
    apiClient.get<EventRecord>(API_ENDPOINTS.events.byId(eventId), { token }),
  join: (eventId: string, userId: string, token: string) =>
    apiClient.post<EventRecord, Record<string, never>>(API_ENDPOINTS.events.join(eventId), {}, {
      headers: {
        'X-User-Id': userId,
      },
      token,
    }),
  list: listEvents,
  listByDate: listEventsByDate,
  listByDateRange: listEventsByDateRange,
  update: (eventId: string, payload: EventPayload, token: string) =>
    apiClient.put<EventRecord, EventPayload>(API_ENDPOINTS.events.byId(eventId), payload, { token }),
}
