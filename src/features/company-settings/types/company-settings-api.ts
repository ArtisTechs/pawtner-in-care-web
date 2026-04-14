export interface CompanyAddressPayload {
  address: string
  latitude: number
  long: number
  name: string
}

export interface CompanySettingsPayload {
  addresses: CompanyAddressPayload[]
  contactNumber: string
  emailAddress: string
  linkUrl: string
  maxRescuesPerDay: number
  messageAdminUser?: string
  totalAvailableSpaceForPets: number
}

export interface CompanySettings extends CompanySettingsPayload {
  createdDate?: string | null
  id: string
  updatedDate?: string | null
}
