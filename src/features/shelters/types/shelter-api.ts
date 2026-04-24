export interface Shelter {
  active?: boolean | null
  approved?: boolean | null
  createdAt?: string | null
  createdDate?: string | null
  hidden?: boolean | null
  id: string
  name?: string | null
  updatedAt?: string | null
  updatedDate?: string | null
}

export interface ShelterPayload {
  name: string
}

export interface ShelterUpdatePayload {
  active: boolean
  approved: boolean
  hidden?: boolean
  name: string
}

export interface ShelterAssociationPayload {
  shelterId: string
  userId: string
}
