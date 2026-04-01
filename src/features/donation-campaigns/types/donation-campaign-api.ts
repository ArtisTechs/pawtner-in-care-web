export type DonationCampaignStatus = 'ONGOING' | 'COMPLETED' | 'CANCELLED'

export type DonationCampaignType =
  | 'HEALTH'
  | 'FOOD'
  | 'SHELTER'
  | 'RESCUE'
  | 'MEDICINE'
  | 'EDUCATION'
  | 'OTHER'

export interface DonationCampaignPayload {
  deadline?: string
  description?: string
  isUrgent?: boolean
  photo?: string
  startDate?: string
  status: DonationCampaignStatus
  title: string
  totalCost: number
  type: DonationCampaignType
}

export interface DonationCampaign extends DonationCampaignPayload {
  createdDate?: string | null
  id: string
  totalDonatedCost?: number | null
  updatedDate?: string | null
}
