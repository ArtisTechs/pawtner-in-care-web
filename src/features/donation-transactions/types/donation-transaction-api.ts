export interface DonationTransactionUser {
  fullName?: string | null
  email?: string | null
  firstName?: string | null
  id: string
  lastName?: string | null
  middleName?: string | null
}

export interface DonationTransactionPaymentMode {
  accountNumber?: string | null
  id: string
  label?: string | null
  mode?: string | null
  name?: string | null
}

export interface DonationTransactionCampaign {
  id: string
  name?: string | null
  title?: string | null
}

export interface DonationTransaction {
  createdDate?: string | null
  createdAt?: string | null
  donatedAmount?: number | string | null
  donationCampaign?: DonationTransactionCampaign | null
  donationCampaignId?: string | null
  id: string
  message?: string | null
  paymentMode?: DonationTransactionPaymentMode | null
  paymentModeId?: string | null
  photoProof?: string | null
  transactionId?: string | null
  updatedDate?: string | null
  updatedAt?: string | null
  user?: DonationTransactionUser | null
  userId?: string | null
}

export interface DonationTransactionPayload {
  donatedAmount: number
  donationCampaignId: string
  message?: string
  paymentModeId: string
  photoProof: string
  userId: string
}
