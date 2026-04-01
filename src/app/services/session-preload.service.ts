import { authStorage } from '@/features/auth/services/auth.storage'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { userStorage } from '@/shared/services/user.storage'

type UserWithId = {
  id: string
  [key: string]: unknown
}

const isUserWithId = (value: unknown): value is UserWithId => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && record.id.length > 0
}

const persistSessionSnapshot = async (session: AuthSession) => {
  authStorage.setSession(session)

  if (isUserWithId(session.user)) {
    userStorage.setUserProfile(session.user)
  }
}

export const sessionPreloadService = {
  async clearSessionCache(userId?: string) {
    authStorage.clearSession()

    if (userId) {
      userStorage.clearUserProfile(userId)
    }
  },

  async preloadSessionData(session: AuthSession) {
    await persistSessionSnapshot(session)
    return session
  },
}
