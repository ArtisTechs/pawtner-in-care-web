const USER_PROFILE_STORAGE_KEY_PREFIX = '@pawtner/users/profile'

type StoredUserProfile = {
  id: string
  [key: string]: unknown
}

const getUserProfileKey = (userId: string) => `${USER_PROFILE_STORAGE_KEY_PREFIX}/${userId}`

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

export const userStorage = {
  clearUserProfile: (userId: string) => removeStorageValue(getUserProfileKey(userId)),
  async getUserProfile(userId: string) {
    const rawValue = readStorageValue(getUserProfileKey(userId))

    if (!rawValue) {
      return null
    }

    try {
      return JSON.parse(rawValue) as StoredUserProfile
    } catch {
      removeStorageValue(getUserProfileKey(userId))
      return null
    }
  },
  setUserProfile: (profile: StoredUserProfile) =>
    writeStorageValue(getUserProfileKey(profile.id), JSON.stringify(profile)),
}
