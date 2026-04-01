import { useEffect, useState } from 'react'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { userStorage } from '@/shared/services/user.storage'
import { getUserIdFromUnknownUser, resolveProfilePatch } from '@/shared/lib/profile/header-profile'
import type { HeaderProfile } from '@/shared/types/layout'

type UseHeaderProfileOptions = {
  fallbackProfile: HeaderProfile
  session?: AuthSession | null
}

export const useHeaderProfile = ({ fallbackProfile, session }: UseHeaderProfileOptions) => {
  const [profile, setProfile] = useState<HeaderProfile>(fallbackProfile)

  useEffect(() => {
    let isMounted = true

    const hydrateHeaderProfile = async () => {
      const sessionUser = session?.user
      const sessionUserId = getUserIdFromUnknownUser(sessionUser)
      const cachedUser = sessionUserId ? await userStorage.getUserProfile(sessionUserId) : null

      const resolvedProfile: HeaderProfile = {
        ...fallbackProfile,
        ...resolveProfilePatch(sessionUser),
        ...resolveProfilePatch(cachedUser),
      }

      if (isMounted) {
        setProfile(resolvedProfile)
      }
    }

    void hydrateHeaderProfile()

    return () => {
      isMounted = false
    }
  }, [fallbackProfile, session])

  return profile
}
