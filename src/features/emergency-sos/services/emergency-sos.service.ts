import type {
  CreateEmergencySosPayload,
  EmergencySos,
  EmergencySosCountResponse,
  EmergencySosListQuery,
  EmergencySosListResult,
  UpdateEmergencySosPayload,
} from '@/features/emergency-sos/types/emergency-sos-api'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

type EmergencySosListResponse =
  | EmergencySos[]
  | {
      content?: EmergencySos[] | null
      first?: boolean | null
      last?: boolean | null
      number?: number | null
      page?: number | null
      size?: number | null
      totalElements?: number | null
      totalPages?: number | null
    }

const inFlightListRequests = new Map<string, Promise<EmergencySosListResult>>()

const normalizeNumeric = (value: number | null | undefined, fallbackValue: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  return fallbackValue
}

const normalizeEmergencySosListResponse = (
  value: EmergencySosListResponse,
  fallbackPage: number,
  fallbackSize: number,
): EmergencySosListResult => {
  if (Array.isArray(value)) {
    return {
      isFirst: true,
      isLast: true,
      items: value,
      page: 0,
      size: value.length,
      totalElements: value.length,
      totalPages: value.length ? 1 : 0,
    }
  }

  const items = value && Array.isArray(value.content) ? value.content : []
  const page = normalizeNumeric(value?.number ?? value?.page, fallbackPage)
  const size = normalizeNumeric(value?.size, fallbackSize)
  const totalElements = normalizeNumeric(value?.totalElements, items.length)
  const totalPages = normalizeNumeric(
    value?.totalPages,
    size > 0 ? Math.max(1, Math.ceil(totalElements / size)) : items.length ? 1 : 0,
  )

  return {
    isFirst: Boolean(value?.first ?? page <= 0),
    isLast: Boolean(value?.last ?? page >= totalPages - 1),
    items,
    page,
    size,
    totalElements,
    totalPages,
  }
}

const buildListCacheKey = (token: string, queryString: string) => `${token}::${queryString}`

const buildListQueryString = (query?: EmergencySosListQuery) => {
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
  appendIfPresent('type', query.type)
  appendIfPresent('status', query.status)
  appendIfPresent('personFilledEmail', query.personFilledEmail)
  appendIfPresent('page', query.page)
  appendIfPresent('size', query.size)
  appendIfPresent('sortBy', query.sortBy)
  appendIfPresent('sortDir', query.sortDir)
  appendIfPresent('ignorePagination', query.ignorePagination)

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}

const list = (token: string, query?: EmergencySosListQuery) => {
  const queryString = buildListQueryString(query)
  const cacheKey = buildListCacheKey(token, queryString)
  const inFlightRequest = inFlightListRequests.get(cacheKey)
  if (inFlightRequest) {
    return inFlightRequest
  }

  const request = apiClient
    .get<EmergencySosListResponse>(`${API_ENDPOINTS.emergencySos.base}${queryString}`, { token })
    .then((response) =>
      normalizeEmergencySosListResponse(response, query?.page ?? 0, query?.size ?? 20),
    )

  inFlightListRequests.set(cacheKey, request)

  void request.finally(() => {
    inFlightListRequests.delete(cacheKey)
  })

  return request
}

export const emergencySosService = {
  create: (payload: CreateEmergencySosPayload, token: string) =>
    apiClient.post<EmergencySos, CreateEmergencySosPayload>(API_ENDPOINTS.emergencySos.base, payload, { token }),
  delete: (id: string, token: string) => apiClient.delete<null>(API_ENDPOINTS.emergencySos.byId(id), { token }),
  getOne: (id: string, token: string) => apiClient.get<EmergencySos>(API_ENDPOINTS.emergencySos.byId(id), { token }),
  list: list,
  listStatuses: (token: string) => apiClient.get<string[]>(API_ENDPOINTS.emergencySos.statuses, { token }),
  listTypes: (token: string) => apiClient.get<string[]>(API_ENDPOINTS.emergencySos.types, { token }),
  total: (token: string, query?: EmergencySosListQuery) => {
    const queryString = buildListQueryString(query)
    return apiClient.get<EmergencySosCountResponse>(`${API_ENDPOINTS.emergencySos.count}${queryString}`, { token })
  },
  update: (id: string, payload: UpdateEmergencySosPayload, token: string) =>
    apiClient.put<EmergencySos, UpdateEmergencySosPayload>(API_ENDPOINTS.emergencySos.byId(id), payload, {
      token,
    }),
}
