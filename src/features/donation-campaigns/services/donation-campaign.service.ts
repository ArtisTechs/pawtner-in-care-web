import type {
  DonationCampaign,
  DonationCampaignPayload,
  DonationCampaignType,
} from '@/features/donation-campaigns/types/donation-campaign-api'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

const inFlightDonationCampaignListRequests = new Map<string, Promise<DonationCampaign[]>>()
const inFlightDonationCampaignTypesRequests = new Map<string, Promise<DonationCampaignType[]>>()

type DonationCampaignListResponse = DonationCampaign[] | { content?: DonationCampaign[] | null }

const normalizeDonationCampaignListResponse = (value: DonationCampaignListResponse) => {
  if (Array.isArray(value)) {
    return value
  }

  if (value && Array.isArray(value.content)) {
    return value.content
  }

  return []
}

const listDonationCampaigns = (token: string) => {
  const cachedRequest = inFlightDonationCampaignListRequests.get(token)
  if (cachedRequest) {
    return cachedRequest
  }

  const request = apiClient
    .get<DonationCampaignListResponse>(API_ENDPOINTS.donationCampaigns.base, { token })
    .then(normalizeDonationCampaignListResponse)

  inFlightDonationCampaignListRequests.set(token, request)

  void request.finally(() => {
    inFlightDonationCampaignListRequests.delete(token)
  })

  return request
}

const getDonationCampaignTypes = (token: string) => {
  const cachedRequest = inFlightDonationCampaignTypesRequests.get(token)
  if (cachedRequest) {
    return cachedRequest
  }

  const request = apiClient.get<DonationCampaignType[]>(API_ENDPOINTS.donationCampaigns.types, { token })
  inFlightDonationCampaignTypesRequests.set(token, request)

  void request.finally(() => {
    inFlightDonationCampaignTypesRequests.delete(token)
  })

  return request
}

export const donationCampaignService = {
  create: (payload: DonationCampaignPayload, token: string) =>
    apiClient.post<DonationCampaign, DonationCampaignPayload>(
      API_ENDPOINTS.donationCampaigns.base,
      payload,
      { token },
    ),
  delete: (campaignId: string, token: string) =>
    apiClient.delete<null>(API_ENDPOINTS.donationCampaigns.byId(campaignId), { token }),
  getOne: (campaignId: string, token: string) =>
    apiClient.get<DonationCampaign>(API_ENDPOINTS.donationCampaigns.byId(campaignId), { token }),
  getTypes: getDonationCampaignTypes,
  list: listDonationCampaigns,
  update: (campaignId: string, payload: DonationCampaignPayload, token: string) =>
    apiClient.put<DonationCampaign, DonationCampaignPayload>(
      API_ENDPOINTS.donationCampaigns.byId(campaignId),
      payload,
      { token },
    ),
}
