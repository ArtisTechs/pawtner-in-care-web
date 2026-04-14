import type {
  CreateGiftLogPayload,
  GiftLog,
  GiftLogListQuery,
  UpdateGiftLogPayload,
} from '@/features/gift-logs/types/gift-log-api'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

type GiftLogListResponse = GiftLog[] | { content?: GiftLog[] | null }

const inFlightGiftLogListRequests = new Map<string, Promise<GiftLog[]>>()

const normalizeGiftLogListResponse = (value: GiftLogListResponse): GiftLog[] => {
  if (Array.isArray(value)) {
    return value
  }

  if (value && Array.isArray(value.content)) {
    return value.content
  }

  return []
}

const appendIfPresent = (params: URLSearchParams, key: string, value?: string | number | boolean) => {
  if (value === undefined || value === null || value === '') {
    return
  }

  params.set(key, String(value))
}

const buildListQueryString = (query?: GiftLogListQuery) => {
  if (!query) {
    return ''
  }

  const params = new URLSearchParams()
  appendIfPresent(params, 'search', query.search)
  appendIfPresent(params, 'status', query.status)
  appendIfPresent(params, 'deliveryType', query.deliveryType)
  appendIfPresent(params, 'page', query.page)
  appendIfPresent(params, 'size', query.size)
  appendIfPresent(params, 'sortBy', query.sortBy)
  appendIfPresent(params, 'sortDir', query.sortDir)
  appendIfPresent(params, 'ignorePagination', query.ignorePagination)

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}

const listGiftLogs = (token: string, query?: GiftLogListQuery) => {
  const queryString = buildListQueryString(query)
  const requestKey = `${token}:${queryString}`
  const cachedRequest = inFlightGiftLogListRequests.get(requestKey)
  if (cachedRequest) {
    return cachedRequest
  }

  const request = apiClient
    .get<GiftLogListResponse>(`${API_ENDPOINTS.giftLogs.base}${queryString}`, { token })
    .then(normalizeGiftLogListResponse)

  inFlightGiftLogListRequests.set(requestKey, request)
  void request.finally(() => {
    inFlightGiftLogListRequests.delete(requestKey)
  })

  return request
}

export const giftLogService = {
  create: (payload: CreateGiftLogPayload, token: string) =>
    apiClient.post<GiftLog, CreateGiftLogPayload>(API_ENDPOINTS.giftLogs.base, payload, { token }),
  delete: (giftLogId: string, token: string) => apiClient.delete<null>(API_ENDPOINTS.giftLogs.byId(giftLogId), { token }),
  getOne: (giftLogId: string, token: string) => apiClient.get<GiftLog>(API_ENDPOINTS.giftLogs.byId(giftLogId), { token }),
  list: listGiftLogs,
  update: (giftLogId: string, payload: UpdateGiftLogPayload, token: string) =>
    apiClient.put<GiftLog, UpdateGiftLogPayload>(API_ENDPOINTS.giftLogs.byId(giftLogId), payload, { token }),
  updateStatus: (giftLogId: string, status: string, token: string) =>
    apiClient.patch<GiftLog, Record<string, never>>(API_ENDPOINTS.giftLogs.byIdStatus(giftLogId, status), {}, { token }),
}
