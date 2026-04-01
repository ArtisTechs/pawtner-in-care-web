import type { FavoritePetResponse, Pet, PetPayload } from '@/features/pets/types/pet-api'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

const inFlightPetListRequests = new Map<string, Promise<Pet[]>>()

type PetListResponse = Pet[] | { content?: Pet[] | null }

const normalizePetListResponse = (value: PetListResponse): Pet[] => {
  if (Array.isArray(value)) {
    return value
  }

  if (value && Array.isArray(value.content)) {
    return value.content
  }

  return []
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
  list: listPets,
  removeFromFavorites: (petId: string, userId: string, token: string) =>
    apiClient.delete<FavoritePetResponse>(API_ENDPOINTS.pets.favorites(petId), {
      headers: { 'X-User-Id': userId },
      token,
    }),
  update: (petId: string, payload: PetPayload, token: string) =>
    apiClient.put<Pet, PetPayload>(API_ENDPOINTS.pets.byId(petId), payload, { token }),
}
