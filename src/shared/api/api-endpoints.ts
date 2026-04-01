const AUTH_BASE_PATH = '/auth'
const PET_BASE_PATH = '/pets'
const DONATION_CAMPAIGN_BASE_PATH = '/donation-campaigns'
const ADOPTION_REQUEST_BASE_PATH = '/adoption-requests'

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
    userFavorites: (userId: string) => `/users/${userId}/favorite-pets`,
  },
  adoptionRequests: {
    base: ADOPTION_REQUEST_BASE_PATH,
    byIdStatus: (requestId: string) => `${ADOPTION_REQUEST_BASE_PATH}/${requestId}/status`,
    byUser: (userId: string) => `/users/${userId}/adoption-requests`,
  },
  donationCampaigns: {
    base: DONATION_CAMPAIGN_BASE_PATH,
    byId: (id: string) => `${DONATION_CAMPAIGN_BASE_PATH}/${id}`,
    types: `${DONATION_CAMPAIGN_BASE_PATH}/types`,
  },
} as const
