import { useCallback, useEffect, useRef, useState } from 'react'
import { APP_ROUTES } from '@/app/routes/route-paths'
import { sessionPreloadService } from '@/app/services/session-preload.service'
import { authStorage } from '@/features/auth/services/auth.storage'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { getAuthSessionUserId, isAdminAuthSession } from '@/features/auth/utils/auth-utils'
import { subscribeToAuthSessionInvalid } from '@/shared/api/auth-session-events'
import { wait } from '@/shared/lib/async/wait'

const LOGOUT_DELAY_MS = 900

const hasValidSession = (session: AuthSession | null) =>
  Boolean(session?.accessToken) && isAdminAuthSession(session)

export const useAuthSession = () => {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isHydrating, setIsHydrating] = useState(true)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const sessionRef = useRef<AuthSession | null>(null)
  const isSigningOutRef = useRef(false)

  useEffect(() => {
    let isMounted = true

    const hydrateSession = async () => {
      try {
        const storedSession = await authStorage.getSession()
        const isSessionAllowed = hasValidSession(storedSession)

        if (storedSession && !isSessionAllowed) {
          const userId = getAuthSessionUserId(storedSession?.user)
          await sessionPreloadService.clearSessionCache(userId)
        }

        if (isMounted) {
          setSession(isSessionAllowed ? storedSession : null)
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

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    isSigningOutRef.current = isSigningOut
  }, [isSigningOut])

  const handleLogout = useCallback(() => {
    if (isSigningOutRef.current) {
      return
    }

    isSigningOutRef.current = true
    const userId = getAuthSessionUserId(sessionRef.current?.user)
    const signOut = async () => {
      setIsSigningOut(true)

      try {
        await Promise.all([sessionPreloadService.clearSessionCache(userId), wait(LOGOUT_DELAY_MS)])
      } finally {
        sessionRef.current = null
        setSession(null)
        isSigningOutRef.current = false
        setIsSigningOut(false)
      }
    }

    void signOut()
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeToAuthSessionInvalid(() => {
      handleLogout()
    })

    return unsubscribe
  }, [handleLogout])

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
