export const LIST_INITIAL_BATCH_SIZE = 12
export const LIST_BATCH_SIZE = 12
export const LIST_SKELETON_ROW_COUNT = 8

export interface AddVolunteerForm {
  description: string
  endDate: string
  endTime: string
  link: string
  photo: string
  startDate: string
  startTime: string
  title: string
}

export const DEFAULT_ADD_VOLUNTEER_FORM: AddVolunteerForm = {
  description: '',
  endDate: '',
  endTime: '',
  link: '',
  photo: '',
  startDate: '',
  startTime: '',
  title: '',
}
