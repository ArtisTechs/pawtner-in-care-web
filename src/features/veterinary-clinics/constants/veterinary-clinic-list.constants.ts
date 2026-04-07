export const LIST_INITIAL_BATCH_SIZE = 12
export const LIST_BATCH_SIZE = 12
export const LIST_SKELETON_ROW_COUNT = 8

export interface AddVeterinaryClinicForm {
  closingTime: string
  contactNumbers: string[]
  description: string
  latitude: string
  locationAddress: string
  logo: string
  longitude: string
  name: string
  openDays: string
  photo: string
  openingTime: string
  ratings: string
  video: string
}

export const DEFAULT_ADD_VETERINARY_CLINIC_FORM: AddVeterinaryClinicForm = {
  closingTime: '',
  contactNumbers: [''],
  description: '',
  latitude: '',
  locationAddress: '',
  logo: '',
  longitude: '',
  name: '',
  openDays: '',
  photo: '',
  openingTime: '',
  ratings: '',
  video: '',
}
