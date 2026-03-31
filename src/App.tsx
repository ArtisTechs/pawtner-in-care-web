import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { APP_ROUTES } from './constants/routes'
import DashboardPage from './pages/DashboardPage/DashboardPage'
import SignInPage from './pages/SignIn/SignInPage'
import { authStorage } from './services/auth/auth.storage'
import type { AuthSession } from './types/auth-api'

const hasValidSession = (session: AuthSession | null) => Boolean(session?.accessToken)

function App() {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isHydrating, setIsHydrating] = useState(true)

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

    hydrateSession()

    return () => {
      isMounted = false
    }
  }, [])

  if (isHydrating) {
    return null
  }

  const isAuthenticated = hasValidSession(session)
  const defaultRoute = isAuthenticated ? APP_ROUTES.dashboard : APP_ROUTES.login

  return (
    <BrowserRouter>
      <Routes>
        <Route path={APP_ROUTES.root} element={<Navigate to={defaultRoute} replace />} />

        <Route
          path={APP_ROUTES.login}
          element={
            isAuthenticated ? (
              <Navigate to={APP_ROUTES.dashboard} replace />
            ) : (
              <SignInPage onSignInSuccess={setSession} />
            )
          }
        />

        <Route
          path={APP_ROUTES.dashboard}
          element={
            isAuthenticated ? (
              <DashboardPage session={session} />
            ) : (
              <Navigate to={APP_ROUTES.login} replace />
            )
          }
        />

        <Route path="*" element={<Navigate to={defaultRoute} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
