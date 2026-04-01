import { useCallback, useEffect, useState } from 'react'
import { APP_ROUTES } from '@/app/routes/route-paths'
import { sessionPreloadService } from '@/app/services/session-preload.service'
import { authStorage } from '@/features/auth/services/auth.storage'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { wait } from '@/shared/lib/async/wait'

const LOGOUT_DELAY_MS = 900

const hasValidSession = (session: AuthSession | null) => Boolean(session?.accessToken)

const getSessionUserId = (user: AuthSession['user']) => {
  if (!user || typeof user !== 'object') {
    return undefined
  }

  const record = user as Record<string, unknown>

  if (typeof record.id === 'string' && record.id.trim()) {
    return record.id.trim()
  }

  if (typeof record.userId === 'string' && record.userId.trim()) {
    return record.userId.trim()
  }

  return undefined
}

export const useAuthSession = () => {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isHydrating, setIsHydrating] = useState(true)
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    let isMounted = true

    const hydrateSession = async () => {
      try {
        const storedSession = await authStorage.getSession()

        if (isMounted) {
          setSession(storedSession)
        }
      } finally {
        if (isMounted) {
          setIsHydrating(false)
        }
      }
    }

    void hydrateSession()

    return () => {
      isMounted = false
    }
  }, [])

  const handleLogout = useCallback(() => {
    if (isSigningOut) {
      return
    }

    const userId = getSessionUserId(session?.user)
    const signOut = async () => {
      setIsSigningOut(true)

      try {
        await Promise.all([sessionPreloadService.clearSessionCache(userId), wait(LOGOUT_DELAY_MS)])
      } finally {
        setSession(null)
        setIsSigningOut(false)
      }
    }

    void signOut()
  }, [isSigningOut, session])

  const isAuthenticated = hasValidSession(session)
  const defaultRoute = isAuthenticated ? APP_ROUTES.dashboard : APP_ROUTES.login

  return {
    defaultRoute,
    isAuthenticated,
    isHydrating,
    isSigningOut,
    onLogout: handleLogout,
    onSignInSuccess: setSession,
    session,
  }
}
