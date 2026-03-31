import type { AuthSession } from '../../types/auth-api'

const AUTH_SESSION_STORAGE_KEY = '@pawtner/auth/session'
const GET_STARTED_SEEN_KEY_PREFIX = '@pawtner/auth/get-started-seen'

const getGetStartedSeenKey = (userId: string) =>
  `${GET_STARTED_SEEN_KEY_PREFIX}/${userId}`

const readStorageValue = (key: string) => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const writeStorageValue = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage access can fail in private mode or restrictive browser settings.
  }
}

const removeStorageValue = (key: string) => {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Storage access can fail in private mode or restrictive browser settings.
  }
}

export const authStorage = {
  clearSession: () => removeStorageValue(AUTH_SESSION_STORAGE_KEY),
  async hasSeenGetStarted(userId: string) {
    const seenFlag = readStorageValue(getGetStartedSeenKey(userId))
    return seenFlag === '1'
  },
  async getSession() {
    const rawValue = readStorageValue(AUTH_SESSION_STORAGE_KEY)

    if (!rawValue) {
      return null
    }

    try {
      return JSON.parse(rawValue) as AuthSession
    } catch {
      removeStorageValue(AUTH_SESSION_STORAGE_KEY)
      return null
    }
  },
  markGetStartedSeen: (userId: string) => writeStorageValue(getGetStartedSeenKey(userId), '1'),
  setSession: (session: AuthSession) =>
    writeStorageValue(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session)),
}
