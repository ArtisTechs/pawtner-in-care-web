export type PetStatus = 'RESCUED' | 'ADOPTED' | 'ONGOING_ADOPTION' | 'AVAILABLE_FOR_ADOPTION'

export interface PetPayload {
  adoptionDate?: string | null
  birthDate?: string | null
  description?: string | null
  gender: string
  height?: number | null
  isVaccinated?: boolean
  name: string
  photo?: string | null
  race?: string | null
  rescuedDate?: string | null
  status: PetStatus
  type: string
  videos?: string | null
  weight?: number | null
}

export interface PetAdopter {
  email?: string | null
  firstName?: string | null
  id: string
  lastName?: string | null
  middleName?: string | null
  profilePicture?: string | null
}

export interface Pet extends PetPayload {
  adoptedBy?: string | PetAdopter | null
  age?: number | null
  id: string
}

export interface FavoritePetResponse {
  favorited: boolean
  petId: string
  userId: string
}
