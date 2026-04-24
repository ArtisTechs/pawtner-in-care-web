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
const CHAT_BASE_PATH = '/chat'
const TODO_BASE_PATH = '/todos'
const ITEM_LISTING_BASE_PATH = '/item-listings'
const GIFT_LOG_BASE_PATH = '/gift-logs'
const NOTIFICATION_BASE_PATH = '/notifications'
const SUPPORT_BASE_PATH = '/support'
const SHELTER_BASE_PATH = '/shelters'

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
    totalAmount: `${DONATION_TRANSACTION_BASE_PATH}/total-amount`,
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
    assignedUsersById: (id: string) => `${GAMIFICATION_BASE_PATH}/achievements/${id}`,
    assign: `${GAMIFICATION_BASE_PATH}/admin/achievements/assign`,
    assignmentById: (userAchievementId: string) =>
      `${GAMIFICATION_BASE_PATH}/admin/achievements/assignments/${userAchievementId}`,
    byId: (id: string) => `${GAMIFICATION_BASE_PATH}/admin/achievements/${id}`,
    byUser: (userId: string) => `${GAMIFICATION_BASE_PATH}/users/${userId}/achievements`,
  },
  heroesWall: {
    base: `${GAMIFICATION_BASE_PATH}/heroes-wall`,
  },
  communityPosts: {
    base: COMMUNITY_POST_BASE_PATH,
    byId: (id: string) => `${COMMUNITY_POST_BASE_PATH}/${id}`,
    comments: (id: string) => `${COMMUNITY_POST_BASE_PATH}/${id}/comments`,
    hidden: (id: string) => `${COMMUNITY_POST_BASE_PATH}/${id}/hidden`,
    likes: (id: string) => `${COMMUNITY_POST_BASE_PATH}/${id}/likes`,
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
  todos: {
    base: TODO_BASE_PATH,
    byId: (id: string) => `${TODO_BASE_PATH}/${id}`,
    done: (id: string, isDone: boolean) => `${TODO_BASE_PATH}/${id}/done?isDone=${isDone}`,
    starred: (id: string, starred: boolean) => `${TODO_BASE_PATH}/${id}/starred?starred=${starred}`,
  },
  itemListings: {
    base: ITEM_LISTING_BASE_PATH,
    byId: (id: string) => `${ITEM_LISTING_BASE_PATH}/${id}`,
    show: (id: string, isShow: boolean) => `${ITEM_LISTING_BASE_PATH}/${id}/show?isShow=${isShow}`,
    boxById: (id: string, quantity?: number) => {
      const basePath = `${ITEM_LISTING_BASE_PATH}/${id}/box`
      if (quantity === undefined) {
        return basePath
      }

      return `${basePath}?quantity=${encodeURIComponent(String(quantity))}`
    },
    favoritesById: (id: string) => `${ITEM_LISTING_BASE_PATH}/${id}/favorites`,
    userBoxItems: (userId: string) => `${USER_BASE_PATH}/${userId}/box-items`,
    userFavoriteItems: (userId: string) => `${USER_BASE_PATH}/${userId}/favorite-items`,
  },
  giftLogs: {
    base: GIFT_LOG_BASE_PATH,
    byId: (id: string) => `${GIFT_LOG_BASE_PATH}/${id}`,
    byIdStatus: (id: string, status: string) =>
      `${GIFT_LOG_BASE_PATH}/${id}/status?status=${encodeURIComponent(status)}`,
  },
  chat: {
    base: CHAT_BASE_PATH,
    byId: (conversationId: string) => `${CHAT_BASE_PATH}/conversations/${conversationId}`,
    bulkDelete: `${CHAT_BASE_PATH}/conversations/bulk`,
    conversations: `${CHAT_BASE_PATH}/conversations`,
    privateConversation: `${CHAT_BASE_PATH}/conversations/private`,
    messages: (conversationId: string) => `${CHAT_BASE_PATH}/conversations/${conversationId}/messages`,
    seen: (conversationId: string) => `${CHAT_BASE_PATH}/conversations/${conversationId}/seen`,
    starred: (conversationId: string) => `${CHAT_BASE_PATH}/conversations/${conversationId}/starred`,
    unreadCount: `${CHAT_BASE_PATH}/conversations/unread-count`,
  },
  notifications: {
    base: NOTIFICATION_BASE_PATH,
    me: `${NOTIFICATION_BASE_PATH}/me`,
    my: `${NOTIFICATION_BASE_PATH}/my`,
    byId: (notificationId: string) => `${NOTIFICATION_BASE_PATH}/my/${notificationId}`,
    clearAll: `${NOTIFICATION_BASE_PATH}/my/clear-all`,
    markRead: (notificationId: string) => `${NOTIFICATION_BASE_PATH}/my/${notificationId}/read`,
    markUnread: (notificationId: string) => `${NOTIFICATION_BASE_PATH}/my/${notificationId}/unread`,
    readAll: `${NOTIFICATION_BASE_PATH}/my/read-all`,
    unreadCount: `${NOTIFICATION_BASE_PATH}/my/unread-count`,
  },
  support: {
    base: SUPPORT_BASE_PATH,
    flow: `${SUPPORT_BASE_PATH}/flow`,
    adminFlow: `${SUPPORT_BASE_PATH}/admin/flow`,
    adminImportFlow: `${SUPPORT_BASE_PATH}/admin/flow/import`,
  },
  shelters: {
    base: SHELTER_BASE_PATH,
    public: `${SHELTER_BASE_PATH}/public`,
    byId: (id: string) => `${SHELTER_BASE_PATH}/${id}`,
    byIdUsers: (id: string) => `${SHELTER_BASE_PATH}/${id}/users`,
    meAssociation: `${SHELTER_BASE_PATH}/me/association`,
    associations: `${SHELTER_BASE_PATH}/associations`,
    associationsByUserId: (userId: string) => `${SHELTER_BASE_PATH}/associations/${userId}`,
  },
} as const
