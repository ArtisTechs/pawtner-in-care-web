const AUTH_BASE_PATH = '/auth'
const PET_BASE_PATH = '/pets'
const USER_BASE_PATH = '/users'
const DONATION_CAMPAIGN_BASE_PATH = '/donation-campaigns'
const DONATION_TRANSACTION_BASE_PATH = '/donation-transactions'
const ADOPTION_REQUEST_BASE_PATH = '/adoption-requests'
const PAYMENT_MODE_BASE_PATH = '/payment-modes'
const VETERINARY_CLINIC_BASE_PATH = '/veterinary-clinics'
const EVENT_BASE_PATH = '/events'
const VOLUNTEER_BASE_PATH = '/volunteers'
const GAMIFICATION_BASE_PATH = '/gamification'
const COMMUNITY_POST_BASE_PATH = '/community/posts'
const COMPANY_SETTINGS_BASE_PATH = '/company-settings'
const DASHBOARD_BASE_PATH = '/dashboard'
const EMERGENCY_SOS_BASE_PATH = '/emergency-sos'

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
    count: `${PET_BASE_PATH}/count`,
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
  events: {
    base: EVENT_BASE_PATH,
    byDate: (date: string) => `${EVENT_BASE_PATH}?date=${encodeURIComponent(date)}`,
    byId: (id: string) => `${EVENT_BASE_PATH}/${id}`,
    join: (id: string) => `${EVENT_BASE_PATH}/${id}/join`,
  },
  volunteers: {
    base: VOLUNTEER_BASE_PATH,
    byDate: (date: string) => `${VOLUNTEER_BASE_PATH}?date=${encodeURIComponent(date)}`,
    byId: (id: string) => `${VOLUNTEER_BASE_PATH}/${id}`,
    join: (id: string) => `${VOLUNTEER_BASE_PATH}/${id}/join`,
  },
  paymentModes: {
    base: PAYMENT_MODE_BASE_PATH,
    byId: (id: string) => `${PAYMENT_MODE_BASE_PATH}/${id}`,
  },
  veterinaryClinics: {
    base: VETERINARY_CLINIC_BASE_PATH,
    byId: (id: string) => `${VETERINARY_CLINIC_BASE_PATH}/${id}`,
  },
  achievements: {
    base: `${GAMIFICATION_BASE_PATH}/admin/achievements`,
    assign: `${GAMIFICATION_BASE_PATH}/admin/achievements/assign`,
    byId: (id: string) => `${GAMIFICATION_BASE_PATH}/admin/achievements/${id}`,
  },
  heroesWall: {
    base: `${GAMIFICATION_BASE_PATH}/heroes-wall`,
  },
  communityPosts: {
    base: COMMUNITY_POST_BASE_PATH,
    byId: (id: string) => `${COMMUNITY_POST_BASE_PATH}/${id}`,
    hidden: (id: string) => `${COMMUNITY_POST_BASE_PATH}/${id}/hidden`,
  },
  companySettings: {
    base: COMPANY_SETTINGS_BASE_PATH,
  },
  dashboard: {
    base: DASHBOARD_BASE_PATH,
    charts: `${DASHBOARD_BASE_PATH}/charts`,
    topPosts: `${DASHBOARD_BASE_PATH}/top-posts`,
  },
  emergencySos: {
    base: EMERGENCY_SOS_BASE_PATH,
    byId: (id: string) => `${EMERGENCY_SOS_BASE_PATH}/${id}`,
    count: `${EMERGENCY_SOS_BASE_PATH}/count`,
    statuses: `${EMERGENCY_SOS_BASE_PATH}/statuses`,
    types: `${EMERGENCY_SOS_BASE_PATH}/types`,
  },
} as const
