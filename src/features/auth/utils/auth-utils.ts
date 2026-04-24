import type { AuthSession, SendOtpResponse } from '@/features/auth/types/auth-api'

export const DEFAULT_OTP_RESEND_COOLDOWN_SECONDS = 60
export const LOGIN_SUCCESS_DELAY_MS = 900
export type DashboardAccessRole = 'ADMIN' | 'SYSTEM_ADMIN'

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object'

const getStringField = (value: unknown, keys: string[]) => {
  if (!isRecord(value)) {
    return ''
  }

  for (const key of keys) {
    const candidate = value[key]

    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }

  return ''
}

const normalizeRoleToken = (value: string) =>
  value.trim().toUpperCase().replace(/[\s-]+/g, '_')

const resolveRoleTokenFromUser = (user: AuthSession['user']) => {
  const role =
    getStringField(user, ['role', 'userRole', 'userType']) ||
    (isRecord(user) ? getStringField(user.role, ['name', 'label', 'title']) : '')

  return normalizeRoleToken(role)
}

export const getAuthSessionUserId = (user: AuthSession['user']) => {
  const directUserId = getStringField(user, ['id', 'userId', 'uuid', 'sub'])
  if (directUserId) {
    return directUserId
  }

  if (isRecord(user)) {
    return getStringField(user.user, ['id', 'userId', 'uuid', 'sub'])
  }

  return ''
}

export const resolveAuthSessionRole = (session: AuthSession | null) => {
  if (!session) {
    return ''
  }

  return resolveRoleTokenFromUser(session.user).toLowerCase()
}

export const resolveDashboardAccessRole = (session: AuthSession | null): DashboardAccessRole | '' => {
  if (!session) {
    return ''
  }

  const roleToken = resolveRoleTokenFromUser(session.user)

  if (roleToken === 'ADMIN' || roleToken === 'SYSTEM_ADMIN') {
    return roleToken
  }

  return ''
}

export const isAdminAuthSession = (session: AuthSession | null) => {
  return resolveDashboardAccessRole(session) !== ''
}
