export interface VeterinaryClinicPayload {
  closingTime?: string | null
  contactNumbers?: string[]
  description?: string | null
  latitude: number
  locationAddress: string
  logo?: string | null
  long: number
  name: string
  openDays?: string[]
  openingTime?: string | null
  photos?: string[]
  ratings?: string | null
  videos?: string[]
}

export interface VeterinaryClinic extends VeterinaryClinicPayload {
  createdDate?: string | null
  id: string
  updatedDate?: string | null
}
