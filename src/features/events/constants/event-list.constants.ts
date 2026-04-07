export const LIST_INITIAL_BATCH_SIZE = 12
export const LIST_BATCH_SIZE = 12
export const LIST_SKELETON_ROW_COUNT = 8

export interface AddEventForm {
  address: string
  description: string
  endDate: string
  endTime: string
  latitude: string
  link: string
  location: string
  longitude: string
  photo: string
  startDate: string
  startTime: string
  title: string
}

export const DEFAULT_ADD_EVENT_FORM: AddEventForm = {
  address: '',
  description: '',
  endDate: '',
  endTime: '',
  latitude: '',
  link: '',
  location: '',
  longitude: '',
  photo: '',
  startDate: '',
  startTime: '',
  title: '',
}
