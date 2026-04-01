import type { AuthSession } from '@/features/auth/types/auth-api'
import { localStorageService } from '@/shared/lib/storage/local-storage'

const AUTH_SESSION_STORAGE_KEY = '@pawtner/auth/session'
const GET_STARTED_SEEN_KEY_PREFIX = '@pawtner/auth/get-started-seen'

const getGetStartedSeenKey = (userId: string) =>
  `${GET_STARTED_SEEN_KEY_PREFIX}/${userId}`

export const authStorage = {
  clearSession: () => localStorageService.remove(AUTH_SESSION_STORAGE_KEY),
  async hasSeenGetStarted(userId: string) {
    const seenFlag = localStorageService.get(getGetStartedSeenKey(userId))
    return seenFlag === '1'
  },
  async getSession() {
    const rawValue = localStorageService.get(AUTH_SESSION_STORAGE_KEY)

    if (!rawValue) {
      return null
    }

    try {
      return JSON.parse(rawValue) as AuthSession
    } catch {
      localStorageService.remove(AUTH_SESSION_STORAGE_KEY)
      return null
    }
  },
  markGetStartedSeen: (userId: string) =>
    localStorageService.set(getGetStartedSeenKey(userId), '1'),
  setSession: (session: AuthSession) =>
    localStorageService.set(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session)),
}
