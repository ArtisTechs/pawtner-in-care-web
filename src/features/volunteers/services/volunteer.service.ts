import type { VolunteerPayload, VolunteerRecord } from '@/features/volunteers/types/volunteer-api'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

type VolunteerListResponse = VolunteerRecord[] | { content?: VolunteerRecord[] | null }
type VolunteerListSortDir = 'asc' | 'desc'
type VolunteerListQuery = {
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
  sortDir?: VolunteerListSortDir
  startDateFrom?: string
  startDateTo?: string
  startTimeFrom?: string
  startTimeTo?: string
  title?: string
}
type VolunteerDateRangeQuery = Pick<
  VolunteerListQuery,
  'endDateFrom' | 'endDateTo' | 'startDateFrom' | 'startDateTo'
>

const inFlightVolunteerListRequests = new Map<string, Promise<VolunteerRecord[]>>()

const normalizeVolunteerListResponse = (value: VolunteerListResponse) => {
  if (Array.isArray(value)) {
    return value
  }

  if (value && Array.isArray(value.content)) {
    return value.content
  }

  return []
}

const buildListQueryString = (query?: VolunteerListQuery) => {
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

const listVolunteers = (token: string, query?: VolunteerListQuery) => {
  const queryString = buildListQueryString(query)
  const requestKey = `${token}:${queryString}`
  const cachedRequest = inFlightVolunteerListRequests.get(requestKey)
  if (cachedRequest) {
    return cachedRequest
  }

  const request = apiClient
    .get<VolunteerListResponse>(`${API_ENDPOINTS.volunteers.base}${queryString}`, { token })
    .then(normalizeVolunteerListResponse)

  inFlightVolunteerListRequests.set(requestKey, request)

  void request.finally(() => {
    inFlightVolunteerListRequests.delete(requestKey)
  })

  return request
}

const listVolunteersByDate = (date: string, token: string) => {
  return listVolunteers(token, {
    date,
    ignorePagination: true,
  })
}

const listVolunteersByDateRange = (rangeQuery: VolunteerDateRangeQuery, token: string) => {
  return listVolunteers(token, {
    ...rangeQuery,
    ignorePagination: true,
  })
}

export const volunteerService = {
  create: (payload: VolunteerPayload, token: string) =>
    apiClient.post<VolunteerRecord, VolunteerPayload>(API_ENDPOINTS.volunteers.base, payload, { token }),
  delete: (volunteerId: string, token: string) =>
    apiClient.delete<null>(API_ENDPOINTS.volunteers.byId(volunteerId), { token }),
  getOne: (volunteerId: string, token: string) =>
    apiClient.get<VolunteerRecord>(API_ENDPOINTS.volunteers.byId(volunteerId), { token }),
  join: (volunteerId: string, userId: string, token: string) =>
    apiClient.post<VolunteerRecord, Record<string, never>>(API_ENDPOINTS.volunteers.join(volunteerId), {}, {
      headers: {
        'X-User-Id': userId,
      },
      token,
    }),
  list: listVolunteers,
  listByDate: listVolunteersByDate,
  listByDateRange: listVolunteersByDateRange,
  update: (volunteerId: string, payload: VolunteerPayload, token: string) =>
    apiClient.put<VolunteerRecord, VolunteerPayload>(API_ENDPOINTS.volunteers.byId(volunteerId), payload, {
      token,
    }),
}
