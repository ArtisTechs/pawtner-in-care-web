import type {
  AdoptionRequest,
  AdoptionRequestListResult,
  CreateAdoptionRequestPayload,
  UpdateAdoptionRequestStatusPayload,
} from '@/features/adoption-requests/types/adoption-request-api'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

type AdoptionRequestListResponse =
  | AdoptionRequest[]
  | {
      content?: AdoptionRequest[] | null
      first?: boolean | null
      last?: boolean | null
      number?: number | null
      page?: number | null
      size?: number | null
      totalElements?: number | null
      totalPages?: number | null
    }
type AdoptionRequestSortBy =
  | 'requestNumber'
  | 'status'
  | 'createdAt'
  | 'updatedAt'
  | 'reviewedAt'
  | 'pet.name'
  | 'requester.firstName'
  | 'requester.lastName'
  | 'requester.email'
type AdoptionRequestSortDir = 'asc' | 'desc'

type AdoptionRequestListQuery = {
  ignorePagination?: boolean
  page?: number
  petId?: string
  petName?: string
  requestNumber?: string
  requesterEmail?: string
  requesterId?: string
  requesterName?: string
  search?: string
  size?: number
  sortBy?: AdoptionRequestSortBy
  sortDir?: AdoptionRequestSortDir
  status?: AdoptionRequest['status']
}

const inFlightListRequests = new Map<string, Promise<AdoptionRequestListResult>>()
const inFlightByPetRequests = new Map<string, Promise<AdoptionRequest[]>>()
const inFlightByUserRequests = new Map<string, Promise<AdoptionRequest[]>>()

const normalizeNumeric = (value: number | null | undefined, fallbackValue: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  return fallbackValue
}

const normalizeAdoptionRequestListResponse = (
  value: AdoptionRequestListResponse,
  fallbackPage: number,
  fallbackSize: number,
): AdoptionRequestListResult => {
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

const buildByPetCacheKey = (petId: string, token: string) => `${token}::pet::${petId}`
const buildByUserCacheKey = (userId: string, token: string) => `${token}::user::${userId}`
const buildListCacheKey = (token: string, queryString: string) => `${token}::list::${queryString}`

const buildListQueryString = (query?: AdoptionRequestListQuery) => {
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
  appendIfPresent('petId', query.petId)
  appendIfPresent('requesterId', query.requesterId)
  appendIfPresent('status', query.status)
  appendIfPresent('requestNumber', query.requestNumber)
  appendIfPresent('petName', query.petName)
  appendIfPresent('requesterName', query.requesterName)
  appendIfPresent('requesterEmail', query.requesterEmail)
  appendIfPresent('page', query.page)
  appendIfPresent('size', query.size)
  appendIfPresent('sortBy', query.sortBy)
  appendIfPresent('sortDir', query.sortDir)
  appendIfPresent('ignorePagination', query.ignorePagination)

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}

const list = (token: string, query?: AdoptionRequestListQuery) => {
  const queryString = buildListQueryString(query)
  const cacheKey = buildListCacheKey(token, queryString)
  const inFlightRequest = inFlightListRequests.get(cacheKey)
  if (inFlightRequest) {
    return inFlightRequest
  }

  const fallbackPage = query?.page ?? 0
  const fallbackSize = query?.size ?? 20
  const request = apiClient
    .get<AdoptionRequestListResponse>(`${API_ENDPOINTS.adoptionRequests.base}${queryString}`, { token })
    .then((response) => normalizeAdoptionRequestListResponse(response, fallbackPage, fallbackSize))

  inFlightListRequests.set(cacheKey, request)

  void request.finally(() => {
    inFlightListRequests.delete(cacheKey)
  })

  return request
}

const listByPet = (petId: string, token: string) => {
  const cacheKey = buildByPetCacheKey(petId, token)
  const inFlightRequest = inFlightByPetRequests.get(cacheKey)
  if (inFlightRequest) {
    return inFlightRequest
  }

  const request = apiClient
    .get<AdoptionRequestListResponse>(API_ENDPOINTS.pets.adoptionRequests(petId), { token })
    .then((response) => normalizeAdoptionRequestListResponse(response, 0, 0).items)

  inFlightByPetRequests.set(cacheKey, request)

  void request.finally(() => {
    inFlightByPetRequests.delete(cacheKey)
  })

  return request
}

const listByUser = (userId: string, token: string) => {
  const cacheKey = buildByUserCacheKey(userId, token)
  const inFlightRequest = inFlightByUserRequests.get(cacheKey)
  if (inFlightRequest) {
    return inFlightRequest
  }

  const request = apiClient
    .get<AdoptionRequestListResponse>(API_ENDPOINTS.adoptionRequests.byUser(userId), { token })
    .then((response) => normalizeAdoptionRequestListResponse(response, 0, 0).items)

  inFlightByUserRequests.set(cacheKey, request)

  void request.finally(() => {
    inFlightByUserRequests.delete(cacheKey)
  })

  return request
}

export const adoptionRequestService = {
  create: (petId: string, payload: CreateAdoptionRequestPayload, token: string, userId: string) =>
    apiClient.post<AdoptionRequest, CreateAdoptionRequestPayload>(
      API_ENDPOINTS.pets.adoptionRequests(petId),
      payload,
      {
        headers: { 'X-User-Id': userId },
        token,
      },
    ),
  list: list,
  listByPet: listByPet,
  listByUser: listByUser,
  updateStatus: (
    requestId: string,
    payload: UpdateAdoptionRequestStatusPayload,
    token: string,
    userId: string,
  ) =>
    apiClient.patch<AdoptionRequest, UpdateAdoptionRequestStatusPayload>(
      API_ENDPOINTS.adoptionRequests.byIdStatus(requestId),
      payload,
      {
        headers: { 'X-User-Id': userId },
        token,
      },
    ),
}
