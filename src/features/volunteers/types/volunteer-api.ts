export interface VolunteerJoinedUser {
  firstName?: string | null
  id: string
  lastName?: string | null
  middleName?: string | null
  profilePicture?: string | null
}

export interface VolunteerRecord {
  createdDate?: string | null
  description?: string | null
  endDate?: string | null
  endTime?: string | null
  id: string
  joinedUsers?: VolunteerJoinedUser[] | null
  link?: string | null
  photo?: string | null
  startDate?: string | null
  startTime?: string | null
  title?: string | null
  totalJoin?: number | string | null
  updatedDate?: string | null
}

export interface VolunteerPayload {
  description?: string
  endDate: string
  endTime: string
  link?: string
  photo?: string
  startDate: string
  startTime: string
  title: string
}
