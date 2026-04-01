import type {
  DonationCampaignStatus,
  DonationCampaignType,
} from '@/features/donation-campaigns/types/donation-campaign-api'

export const LIST_INITIAL_BATCH_SIZE = 12
export const LIST_BATCH_SIZE = 12
export const LIST_SKELETON_ROW_COUNT = 8

export const DEFAULT_CAMPAIGN_TYPES: DonationCampaignType[] = [
  'HEALTH',
  'FOOD',
  'SHELTER',
  'RESCUE',
  'MEDICINE',
  'EDUCATION',
  'OTHER',
]

export interface AddDonationCampaignForm {
  deadline: string
  description: string
  isUrgent: boolean
  photo: string
  startDate: string
  status: DonationCampaignStatus
  title: string
  totalCost: string
  type: DonationCampaignType
}

export const DEFAULT_ADD_DONATION_CAMPAIGN_FORM: AddDonationCampaignForm = {
  deadline: '',
  description: '',
  isUrgent: false,
  photo: '',
  startDate: '',
  status: 'ONGOING',
  title: '',
  totalCost: '',
  type: 'HEALTH',
}

export const STATUS_LABELS: Record<DonationCampaignStatus, string> = {
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
  ONGOING: 'Ongoing',
}

export const TYPE_LABELS: Record<DonationCampaignType, string> = {
  EDUCATION: 'Education',
  FOOD: 'Food',
  HEALTH: 'Health',
  MEDICINE: 'Medicine',
  OTHER: 'Other',
  RESCUE: 'Rescue',
  SHELTER: 'Shelter',
}
