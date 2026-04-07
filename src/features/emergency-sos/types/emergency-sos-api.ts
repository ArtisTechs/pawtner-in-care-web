export type EmergencySosType = 'INJURED' | 'ACCIDENTS' | 'RANDOM_STRAY' | (string & {})

export type EmergencySosStatus = 'REQUESTED' | 'ONGOING_RESCUE' | 'RESCUED' | (string & {})

export interface EmergencySosPersonFilled {
  email?: string | null
  firstName?: string | null
  id?: string | null
  lastName?: string | null
  middleName?: string | null
}

export interface EmergencySos {
  additionalLocationMessage?: string | null
  addressLocation?: string | null
  createdAt?: string | null
  description?: string | null
  id: string
  latitude?: number | null
  long?: number | null
  personFilled?: EmergencySosPersonFilled | null
  personFilledEmail?: string | null
  personFilledId?: string | null
  status?: EmergencySosStatus | null
  type?: EmergencySosType | null
  updatedAt?: string | null
}

export type EmergencySosSortDir = 'asc' | 'desc'

export interface EmergencySosListQuery {
  ignorePagination?: boolean
  page?: number
  personFilledEmail?: string
  search?: string
  size?: number
  sortBy?: string
  sortDir?: EmergencySosSortDir
  status?: EmergencySosStatus
  type?: EmergencySosType
}

export interface EmergencySosCountResponse {
  total: number
}

export interface CreateEmergencySosPayload {
  additionalLocationMessage?: string
  addressLocation: string
  description?: string
  latitude: number
  long: number
  personFilledId: string
  status: EmergencySosStatus
  type: EmergencySosType
}

export interface UpdateEmergencySosPayload {
  additionalLocationMessage?: string
  addressLocation: string
  description?: string
  latitude: number
  long: number
  personFilledId: string
  status: EmergencySosStatus
  type: EmergencySosType
}
