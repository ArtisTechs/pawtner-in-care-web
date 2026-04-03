const AUTH_BASE_PATH = '/auth'
const PET_BASE_PATH = '/pets'
const USER_BASE_PATH = '/users'
const DONATION_CAMPAIGN_BASE_PATH = '/donation-campaigns'
const DONATION_TRANSACTION_BASE_PATH = '/donation-transactions'
const ADOPTION_REQUEST_BASE_PATH = '/adoption-requests'
const PAYMENT_MODE_BASE_PATH = '/payment-modes'

export const API_ENDPOINTS = {
  auth: {
    base: AUTH_BASE_PATH,
    confirmOtp: `${AUTH_BASE_PATH}/confirm-otp`,
    login: `${AUTH_BASE_PATH}/login`,
    resetPassword: `${AUTH_BASE_PATH}/reset-password`,
    sendOtp: `${AUTH_BASE_PATH}/send-otp`,
    signUp: `${AUTH_BASE_PATH}/signup`,
  },
  pets: {
    base: PET_BASE_PATH,
    adoptionRequests: (petId: string) => `${PET_BASE_PATH}/${petId}/adoption-requests`,
    byId: (id: string) => `${PET_BASE_PATH}/${id}`,
    favorites: (petId: string) => `${PET_BASE_PATH}/${petId}/favorites`,
    userFavorites: (userId: string) => `${USER_BASE_PATH}/${userId}/favorite-pets`,
  },
  users: {
    base: USER_BASE_PATH,
    byIdActive: (id: string) => `${USER_BASE_PATH}/${id}/active`,
    byId: (id: string) => `${USER_BASE_PATH}/${id}`,
    byIdStatus: (id: string) => `${USER_BASE_PATH}/${id}/status`,
    disable: (id: string) => `${USER_BASE_PATH}/${id}/disable`,
    enable: (id: string) => `${USER_BASE_PATH}/${id}/enable`,
  },
  adoptionRequests: {
    base: ADOPTION_REQUEST_BASE_PATH,
    byIdStatus: (requestId: string) => `${ADOPTION_REQUEST_BASE_PATH}/${requestId}/status`,
    byUser: (userId: string) => `${USER_BASE_PATH}/${userId}/adoption-requests`,
  },
  donationCampaigns: {
    base: DONATION_CAMPAIGN_BASE_PATH,
    byId: (id: string) => `${DONATION_CAMPAIGN_BASE_PATH}/${id}`,
    types: `${DONATION_CAMPAIGN_BASE_PATH}/types`,
  },
  donationTransactions: {
    base: DONATION_TRANSACTION_BASE_PATH,
    byId: (id: string) => `${DONATION_TRANSACTION_BASE_PATH}/${id}`,
  },
  paymentModes: {
    base: PAYMENT_MODE_BASE_PATH,
    byId: (id: string) => `${PAYMENT_MODE_BASE_PATH}/${id}`,
  },
} as const
