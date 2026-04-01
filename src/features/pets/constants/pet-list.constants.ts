import type { PetStatus } from '@/features/pets/types/pet-api'

export const LIST_INITIAL_BATCH_SIZE = 12
export const LIST_BATCH_SIZE = 12
export const LIST_SKELETON_ROW_COUNT = 8

export interface AddPetForm {
  adoptionDate: string
  birthDate: string
  description: string
  gender: string
  height: string
  isVaccinated: boolean
  name: string
  photo: string
  race: string
  rescuedDate: string
  status: PetStatus
  type: string
  videos: string
  weight: string
}

export const DEFAULT_ADD_PET_FORM: AddPetForm = {
  adoptionDate: '',
  birthDate: '',
  description: '',
  gender: 'Male',
  height: '',
  isVaccinated: true,
  name: '',
  photo: '',
  race: '',
  rescuedDate: '',
  status: 'AVAILABLE_FOR_ADOPTION' as PetStatus,
  type: 'Dog',
  videos: '',
  weight: '',
}

export const STATUS_LABELS: Record<PetStatus, string> = {
  ADOPTED: 'Adopted',
  AVAILABLE_FOR_ADOPTION: 'Available for adoption',
  ONGOING_ADOPTION: 'Ongoing adoption',
  RESCUED: 'Rescued',
}
