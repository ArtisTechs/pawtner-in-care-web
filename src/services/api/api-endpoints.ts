const AUTH_BASE_PATH = '/auth'

export const API_ENDPOINTS = {
  auth: {
    base: AUTH_BASE_PATH,
    confirmOtp: `${AUTH_BASE_PATH}/confirm-otp`,
    login: `${AUTH_BASE_PATH}/login`,
    resetPassword: `${AUTH_BASE_PATH}/reset-password`,
    sendOtp: `${AUTH_BASE_PATH}/send-otp`,
    signUp: `${AUTH_BASE_PATH}/signup`,
  },
} as const
