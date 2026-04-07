import type {
  VeterinaryClinic,
  VeterinaryClinicPayload,
} from '@/features/veterinary-clinics/types/veterinary-clinic-api'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

const inFlightVeterinaryClinicListRequests = new Map<string, Promise<VeterinaryClinic[]>>()

type VeterinaryClinicListResponse = VeterinaryClinic[] | { content?: VeterinaryClinic[] | null }

const normalizeVeterinaryClinicListResponse = (
  value: VeterinaryClinicListResponse,
): VeterinaryClinic[] => {
  if (Array.isArray(value)) {
    return value
  }

  if (value && Array.isArray(value.content)) {
    return value.content
  }

  return []
}

const listVeterinaryClinics = (token: string) => {
  const cachedRequest = inFlightVeterinaryClinicListRequests.get(token)
  if (cachedRequest) {
    return cachedRequest
  }

  const request = apiClient
    .get<VeterinaryClinicListResponse>(API_ENDPOINTS.veterinaryClinics.base, { token })
    .then(normalizeVeterinaryClinicListResponse)
  inFlightVeterinaryClinicListRequests.set(token, request)

  void request.finally(() => {
    inFlightVeterinaryClinicListRequests.delete(token)
  })

  return request
}

export const veterinaryClinicService = {
  create: (payload: VeterinaryClinicPayload, token: string) =>
    apiClient.post<VeterinaryClinic, VeterinaryClinicPayload>(
      API_ENDPOINTS.veterinaryClinics.base,
      payload,
      { token },
    ),
  delete: (clinicId: string, token: string) =>
    apiClient.delete<null>(API_ENDPOINTS.veterinaryClinics.byId(clinicId), { token }),
  getOne: (clinicId: string, token: string) =>
    apiClient.get<VeterinaryClinic>(API_ENDPOINTS.veterinaryClinics.byId(clinicId), { token }),
  list: listVeterinaryClinics,
  update: (clinicId: string, payload: VeterinaryClinicPayload, token: string) =>
    apiClient.put<VeterinaryClinic, VeterinaryClinicPayload>(
      API_ENDPOINTS.veterinaryClinics.byId(clinicId),
      payload,
      { token },
    ),
}
