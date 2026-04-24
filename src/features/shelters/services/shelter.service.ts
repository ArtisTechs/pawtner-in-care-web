import type {
  Shelter,
  ShelterAssociationPayload,
  ShelterPayload,
  ShelterUpdatePayload,
} from '@/features/shelters/types/shelter-api'
import type { User } from '@/features/users/types/user-api'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

type ShelterListResponse = Shelter[] | { content?: Shelter[] | null }
type ShelterUsersResponse = User[] | { content?: User[] | null }
type PublicShelter = Pick<Shelter, 'id' | 'name'>
type PublicShelterListResponse = PublicShelter[] | { content?: PublicShelter[] | null }

const inFlightShelterListRequests = new Map<string, Promise<Shelter[]>>()
let inFlightPublicShelterListRequest: Promise<PublicShelter[]> | null = null

const normalizeShelterListResponse = (value: ShelterListResponse): Shelter[] => {
  if (Array.isArray(value)) {
    return value
  }

  if (value && Array.isArray(value.content)) {
    return value.content
  }

  return []
}

const listShelters = (token: string) => {
  const cachedRequest = inFlightShelterListRequests.get(token)
  if (cachedRequest) {
    return cachedRequest
  }

  const request = apiClient
    .get<ShelterListResponse>(API_ENDPOINTS.shelters.base, { token })
    .then(normalizeShelterListResponse)
  inFlightShelterListRequests.set(token, request)

  void request.finally(() => {
    inFlightShelterListRequests.delete(token)
  })

  return request
}

const normalizePublicShelterListResponse = (value: PublicShelterListResponse): PublicShelter[] => {
  if (Array.isArray(value)) {
    return value
  }

  if (value && Array.isArray(value.content)) {
    return value.content
  }

  return []
}

const listPublicShelters = () => {
  if (inFlightPublicShelterListRequest) {
    return inFlightPublicShelterListRequest
  }

  const request = apiClient
    .get<PublicShelterListResponse>(API_ENDPOINTS.shelters.public)
    .then(normalizePublicShelterListResponse)
  inFlightPublicShelterListRequest = request

  void request.finally(() => {
    inFlightPublicShelterListRequest = null
  })

  return request
}

const normalizeShelterUsersResponse = (value: ShelterUsersResponse): User[] => {
  if (Array.isArray(value)) {
    return value
  }

  if (value && Array.isArray(value.content)) {
    return value.content
  }

  return []
}

const toggleShelterActive = async (shelterId: string, active: boolean, token: string) => {
  const shelter = await apiClient.get<Shelter>(API_ENDPOINTS.shelters.byId(shelterId), { token })
  const name = shelter.name?.trim()

  if (!name) {
    throw new Error('Unable to update shelter status because shelter name is missing.')
  }

  const payload: ShelterUpdatePayload = {
    active,
    approved: shelter.approved === true,
    name,
  }

  return apiClient.put<Shelter, ShelterUpdatePayload>(API_ENDPOINTS.shelters.byId(shelterId), payload, { token })
}

export const shelterService = {
  associateUserToShelter: (payload: ShelterAssociationPayload, token: string) =>
    apiClient.post<null, ShelterAssociationPayload>(API_ENDPOINTS.shelters.associations, payload, { token }),
  create: (payload: ShelterPayload, token: string) =>
    apiClient.post<Shelter, ShelterPayload>(API_ENDPOINTS.shelters.base, payload, { token }),
  disassociateCurrentSystemAdmin: (token: string) =>
    apiClient.delete<null>(API_ENDPOINTS.shelters.meAssociation, { token }),
  disassociateUserFromShelter: (userId: string, token: string) =>
    apiClient.delete<null>(API_ENDPOINTS.shelters.associationsByUserId(userId), { token }),
  getOne: (shelterId: string, token: string) =>
    apiClient.get<Shelter>(API_ENDPOINTS.shelters.byId(shelterId), { token }),
  listAssignedUsers: (shelterId: string, token: string) =>
    apiClient.get<ShelterUsersResponse>(API_ENDPOINTS.shelters.byIdUsers(shelterId), { token }).then(normalizeShelterUsersResponse),
  list: listShelters,
  listPublic: listPublicShelters,
  toggleActive: toggleShelterActive,
  update: (shelterId: string, payload: ShelterUpdatePayload, token: string) =>
    apiClient.put<Shelter, ShelterUpdatePayload>(API_ENDPOINTS.shelters.byId(shelterId), payload, { token }),
}
