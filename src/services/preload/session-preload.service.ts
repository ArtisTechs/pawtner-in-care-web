import { authStorage } from '../auth/auth.storage'
import { userStorage } from '../user/user.storage'
import type { AuthSession } from '../../types/auth-api'

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
