export interface CompanyAddressPayload {
  address: string
  latitude: number
  long: number
  name: string
}

export interface CompanySettingsAdminUser {
  active?: boolean | null
  createdDate?: string | null
  email?: string | null
  firstName?: string | null
  id: string
  lastName?: string | null
  middleName?: string | null
  profilePicture?: string | null
  role?: string | null
  updatedDate?: string | null
}

export interface CompanySettingsPayload {
  addresses: CompanyAddressPayload[]
  contactNumber: string
  emailAddress: string
  linkUrl?: string
  maxRescuesPerDay: number
  messageAdminUserId?: string
  totalAvailableSpaceForPets: number
}

export interface CompanySettings {
  addresses: CompanyAddressPayload[]
  contactNumber: string
  emailAddress: string
  linkUrl?: string
  maxRescuesPerDay: number
  messageAdminUser?: CompanySettingsAdminUser | null
  createdDate?: string | null
  id: string
  totalAvailableSpaceForPets: number
  updatedDate?: string | null
}

export type SupportFlowImportRequest = Record<string, unknown>
