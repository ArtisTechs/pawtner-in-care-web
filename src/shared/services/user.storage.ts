import { localStorageService } from '@/shared/lib/storage/local-storage'

const USER_PROFILE_STORAGE_KEY_PREFIX = '@pawtner/users/profile'

type StoredUserProfile = {
  id: string
  [key: string]: unknown
}

const getUserProfileKey = (userId: string) =>
  `${USER_PROFILE_STORAGE_KEY_PREFIX}/${userId}`

export const userStorage = {
  clearUserProfile: (userId: string) => localStorageService.remove(getUserProfileKey(userId)),
  async getUserProfile(userId: string) {
    const rawValue = localStorageService.get(getUserProfileKey(userId))

    if (!rawValue) {
      return null
    }

    try {
      return JSON.parse(rawValue) as StoredUserProfile
    } catch {
      localStorageService.remove(getUserProfileKey(userId))
      return null
    }
  },
  setUserProfile: (profile: StoredUserProfile) =>
    localStorageService.set(getUserProfileKey(profile.id), JSON.stringify(profile)),
}
