import type { AddDonationCampaignForm } from '@/features/donation-campaigns/constants/donation-campaign-list.constants'
import type {
  DonationCampaign,
  DonationCampaignPayload,
  DonationCampaignStatus,
} from '@/features/donation-campaigns/types/donation-campaign-api'

const normalizeDateInput = (value?: string | null) => {
  if (!value) {
    return ''
  }

  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return ''
  }

  return trimmedValue.slice(0, 10)
}

const parseOptionalText = (value: string) => {
  const trimmedValue = value.trim()
  return trimmedValue || undefined
}

const parseCurrencyText = (value: string) => {
  const parsedValue = Number.parseFloat(value.trim())
  if (!Number.isFinite(parsedValue)) {
    return undefined
  }

  return parsedValue
}

export const formatCurrency = (value?: number | null) => {
  const safeValue = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return new Intl.NumberFormat('en-PH', { currency: 'PHP', style: 'currency' }).format(safeValue)
}

export const formatDateLabel = (value?: string | null) => {
  if (!value) {
    return 'N/A'
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return 'N/A'
  }

  return parsedDate.toLocaleDateString('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export const mapDonationCampaignToForm = (campaign: DonationCampaign): AddDonationCampaignForm => ({
  deadline: normalizeDateInput(campaign.deadline),
  description: campaign.description ?? '',
  isUrgent: Boolean(campaign.isUrgent),
  photo: campaign.photo ?? '',
  startDate: normalizeDateInput(campaign.startDate),
  status: campaign.status,
  title: campaign.title ?? '',
  totalCost:
    campaign.totalCost === undefined || campaign.totalCost === null ? '' : String(campaign.totalCost),
  type: campaign.type,
})

export const buildDonationCampaignPayload = (
  form: AddDonationCampaignForm,
): DonationCampaignPayload | null => {
  const totalCost = parseCurrencyText(form.totalCost)
  if (totalCost === undefined) {
    return null
  }

  return {
    deadline: parseOptionalText(form.deadline),
    description: parseOptionalText(form.description),
    isUrgent: form.isUrgent,
    photo: parseOptionalText(form.photo),
    startDate: parseOptionalText(form.startDate),
    status: form.status,
    title: form.title.trim(),
    totalCost,
    type: form.type,
  }
}

export const isDeadlineBeforeStartDate = (startDate: string, deadline: string) => {
  const normalizedStartDate = startDate.trim()
  const normalizedDeadline = deadline.trim()

  if (!normalizedStartDate || !normalizedDeadline) {
    return false
  }

  return normalizedDeadline < normalizedStartDate
}

export const resolveStatusClassName = (status: DonationCampaignStatus) => {
  switch (status) {
    case 'COMPLETED':
      return 'statusCompleted'
    case 'CANCELLED':
      return 'statusCancelled'
    case 'ONGOING':
    default:
      return 'statusOngoing'
  }
}
