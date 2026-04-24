import type { PetStatus } from '@/features/pets/types/pet-api'

export type AdoptionRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface AdoptionRequestPet {
  id: string
  name?: string | null
  photo?: string | null
  race?: string | null
  status?: PetStatus | null
  type?: string | null
}

export interface AdoptionRequestRequester {
  email?: string | null
  firstName?: string | null
  id: string
  lastName?: string | null
  middleName?: string | null
}

export interface AdoptionRequest {
  createdAt?: string | null
  id: string
  message?: string | null
  pet?: AdoptionRequestPet | null
  requestNumber?: string | null
  requester?: AdoptionRequestRequester | null
  reviewNotes?: string | null
  reviewedAt?: string | null
  status: AdoptionRequestStatus
  updatedAt?: string | null
}

export interface CreateAdoptionRequestPayload {
  message?: string
}

export type AdoptionRequestReviewStatus = 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface UpdateAdoptionRequestStatusPayload {
  reviewNotes?: string
  status: AdoptionRequestReviewStatus
}

export interface AdoptionRequestListResult {
  isFirst: boolean
  isLast: boolean
  items: AdoptionRequest[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}
