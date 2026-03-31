export interface AuthSession {
  accessToken: string
  tokenType: string
  user: unknown
}

export type OtpPurpose = 'login' | 'reset-password' | 'signup'

export interface LoginPayload {
  email: string
  password: string
}

export interface SendOtpPayload {
  email: string
  purpose: OtpPurpose
}

export interface ConfirmOtpPayload {
  email: string
  otp: string
  purpose: OtpPurpose
}

export interface ResetPasswordPayload {
  confirmPassword: string
  email: string
  newPassword: string
}

export type ApiMessageResponse = {
  email?: string
  message?: string
}

export type SendOtpResponse = ApiMessageResponse & {
  cooldownSeconds?: number
  resendAfterSeconds?: number
  resendInSeconds?: number
  retryAfter?: number
  retryAfterSeconds?: number
}
