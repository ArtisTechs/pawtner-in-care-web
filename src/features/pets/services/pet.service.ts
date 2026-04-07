import type { FavoritePetResponse, Pet, PetPayload } from '@/features/pets/types/pet-api'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

const inFlightPetListRequests = new Map<string, Promise<Pet[]>>()
const inFlightPetCountRequests = new Map<string, Promise<number>>()

type PetListResponse = Pet[] | { content?: Pet[] | null }
type PetCountResponse = { total?: number | null }
type PetCountFilters = Record<string, boolean | number | string | null | undefined>

const normalizePetListResponse = (value: PetListResponse): Pet[] => {
  if (Array.isArray(value)) {
    return value
  }

  if (value && Array.isArray(value.content)) {
    return value.content
  }

  return []
}

const buildCountPath = (filters: PetCountFilters = {}) => {
  const params = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return
    }

    if (typeof value === 'string') {
      const normalizedValue = value.trim()
      if (!normalizedValue) {
        return
      }

      params.set(key, normalizedValue)
      return
    }

    params.set(key, String(value))
  })

  const query = params.toString()
  if (!query) {
    return API_ENDPOINTS.pets.count
  }

  return `${API_ENDPOINTS.pets.count}?${query}`
}

const listPets = (token: string) => {
  const cachedRequest = inFlightPetListRequests.get(token)
  if (cachedRequest) {
    return cachedRequest
  }

  const request = apiClient
    .get<PetListResponse>(API_ENDPOINTS.pets.base, { token })
    .then(normalizePetListResponse)
  inFlightPetListRequests.set(token, request)

  void request.finally(() => {
    inFlightPetListRequests.delete(token)
  })

  return request
}

const countPets = (token: string, filters: PetCountFilters = {}) => {
  const path = buildCountPath(filters)
  const requestKey = `${token}:${path}`
  const cachedRequest = inFlightPetCountRequests.get(requestKey)

  if (cachedRequest) {
    return cachedRequest
  }

  const request = apiClient.get<PetCountResponse>(path, { token }).then((response) => {
    return typeof response?.total === 'number' ? response.total : 0
  })

  inFlightPetCountRequests.set(requestKey, request)

  void request.finally(() => {
    inFlightPetCountRequests.delete(requestKey)
  })

  return request
}

export const petService = {
  addToFavorites: (petId: string, userId: string, token: string) =>
    apiClient.post<FavoritePetResponse, Record<string, never>>(
      API_ENDPOINTS.pets.favorites(petId),
      {},
      {
        headers: { 'X-User-Id': userId },
        token,
      },
    ),
  create: (payload: PetPayload, token: string) =>
    apiClient.post<Pet, PetPayload>(API_ENDPOINTS.pets.base, payload, { token }),
  delete: (petId: string, token: string) =>
    apiClient.delete<null>(API_ENDPOINTS.pets.byId(petId), { token }),
  getOne: (petId: string, token: string) =>
    apiClient.get<Pet>(API_ENDPOINTS.pets.byId(petId), { token }),
  getUserFavoritePets: (userId: string, token: string) =>
    apiClient.get<Pet[]>(API_ENDPOINTS.pets.userFavorites(userId), { token }),
  count: countPets,
  list: listPets,
  removeFromFavorites: (petId: string, userId: string, token: string) =>
    apiClient.delete<FavoritePetResponse>(API_ENDPOINTS.pets.favorites(petId), {
      headers: { 'X-User-Id': userId },
      token,
    }),
  update: (petId: string, payload: PetPayload, token: string) =>
    apiClient.put<Pet, PetPayload>(API_ENDPOINTS.pets.byId(petId), payload, { token }),
}
