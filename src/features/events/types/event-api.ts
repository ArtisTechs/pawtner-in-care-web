export interface EventJoinedUser {
  firstName?: string | null
  id: string
  lastName?: string | null
  middleName?: string | null
  profilePicture?: string | null
}

export interface EventRecord {
  address?: string | null
  createdDate?: string | null
  description?: string | null
  endDate?: string | null
  endTime?: string | null
  id: string
  joinedUsers?: EventJoinedUser[] | null
  latitude?: number | null
  link?: string | null
  location?: string | null
  long?: number | null
  photo?: string | null
  startDate?: string | null
  startTime?: string | null
  time?: string | null
  title?: string | null
  totalJoin?: number | string | null
  updatedDate?: string | null
}

export interface EventPayload {
  address?: string
  description?: string
  endDate: string
  endTime: string
  latitude?: number
  link?: string
  location?: string
  long?: number
  photo?: string
  startDate: string
  startTime: string
  title: string
}
