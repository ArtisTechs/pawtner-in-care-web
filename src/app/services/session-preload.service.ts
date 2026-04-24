import { authStorage } from '@/features/auth/services/auth.storage'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { getAuthSessionUserId } from '@/features/auth/utils/auth-utils'
import { userService } from '@/features/users/services/user.service'
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

type PreloadSessionOptions = {
  refetchCurrentUser?: boolean
}

const inFlightSessionPreloadRequests = new Map<string, Promise<AuthSession>>()

export const sessionPreloadService = {
  async clearSessionCache(userId?: string) {
    authStorage.clearSession()

    if (userId) {
      userStorage.clearUserProfile(userId)
    }
  },

  async preloadSessionData(
    session: AuthSession,
    options: PreloadSessionOptions = {},
  ) {
    const shouldRefetchCurrentUser = options.refetchCurrentUser !== false
    const accessToken = session.accessToken
    const currentUserId = getAuthSessionUserId(session.user)

    if (!shouldRefetchCurrentUser || !accessToken || !currentUserId) {
      await persistSessionSnapshot(session)
      return session
    }

    const requestKey = `${accessToken}:${currentUserId}`
    const inFlightRequest = inFlightSessionPreloadRequests.get(requestKey)
    if (inFlightRequest) {
      return inFlightRequest
    }

    const request = (async () => {
      const currentUser = await userService.getOne(currentUserId, accessToken)
      const hydratedSession: AuthSession = {
        ...session,
        user: currentUser,
      }

      await persistSessionSnapshot(hydratedSession)
      return hydratedSession
    })()

    inFlightSessionPreloadRequests.set(requestKey, request)
    void request.finally(() => {
      inFlightSessionPreloadRequests.delete(requestKey)
    })

    return request
  },
}
