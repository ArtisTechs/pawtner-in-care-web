import type { SendOtpResponse } from '@/features/auth/types/auth-api'

export const DEFAULT_OTP_RESEND_COOLDOWN_SECONDS = 60
export const LOGIN_SUCCESS_DELAY_MS = 900

export const getOtpResendCooldownSeconds = (response: SendOtpResponse | null) => {
  const candidates = [
    response?.cooldownSeconds,
    response?.resendAfterSeconds,
    response?.resendInSeconds,
    response?.retryAfterSeconds,
    response?.retryAfter,
  ]

  for (const value of candidates) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.ceil(parsed)
    }
  }

  return DEFAULT_OTP_RESEND_COOLDOWN_SECONDS
}

export const formatCountdownTime = (seconds: number) => {
  const safeValue = Math.max(0, seconds)
  const minutes = Math.floor(safeValue / 60)
  const remainingSeconds = safeValue % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}
