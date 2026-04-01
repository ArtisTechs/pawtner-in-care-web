import type {
  AdoptionRequest,
  CreateAdoptionRequestPayload,
  UpdateAdoptionRequestStatusPayload,
} from '@/features/adoption-requests/types/adoption-request-api'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

type AdoptionRequestListResponse = AdoptionRequest[] | { content?: AdoptionRequest[] | null }
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

const inFlightListRequests = new Map<string, Promise<AdoptionRequest[]>>()
const inFlightByPetRequests = new Map<string, Promise<AdoptionRequest[]>>()
const inFlightByUserRequests = new Map<string, Promise<AdoptionRequest[]>>()

const normalizeAdoptionRequestListResponse = (value: AdoptionRequestListResponse): AdoptionRequest[] => {
  if (Array.isArray(value)) {
    return value
  }

  if (value && Array.isArray(value.content)) {
    return value.content
  }

  return []
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

  const request = apiClient
    .get<AdoptionRequestListResponse>(`${API_ENDPOINTS.adoptionRequests.base}${queryString}`, { token })
    .then(normalizeAdoptionRequestListResponse)

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
    .then(normalizeAdoptionRequestListResponse)

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
    .then(normalizeAdoptionRequestListResponse)

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
