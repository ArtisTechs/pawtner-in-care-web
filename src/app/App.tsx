import { useEffect } from 'react'
import AppRouter from '@/app/routes/AppRouter'
import { useAuthSession } from '@/app/hooks/useAuthSession'
import ChatRealtimeProvider from '@/features/chat/providers/ChatRealtimeProvider'
import NotificationProvider from '@/features/notifications/providers/NotificationProvider'
import FullScreenLoader from '@/shared/components/ui/FullScreenLoader/FullScreenLoader'
import { initializeUserActionTracking } from '@/shared/api/user-action-tracker'
import { useApiFullScreenLoader } from '@/shared/hooks/useApiFullScreenLoader'

function App() {
  const isApiFullScreenLoaderVisible = useApiFullScreenLoader()
  const {
    defaultRoute,
    isAuthenticated,
    isHydrating,
    isSigningOut,
    onLogout,
    onSignInSuccess,
    session,
  } = useAuthSession()

  useEffect(() => {
    initializeUserActionTracking()
  }, [])

  if (isHydrating) {
    return null
  }

  return (
    <ChatRealtimeProvider session={session}>
      <NotificationProvider session={session}>
        <AppRouter
          defaultRoute={defaultRoute}
          isAuthenticated={isAuthenticated}
          onLogout={onLogout}
          onSignInSuccess={onSignInSuccess}
          session={session}
        />
        <FullScreenLoader
          visible={isSigningOut || isApiFullScreenLoaderVisible}
          subtitle={isSigningOut ? 'Signing you out...' : undefined}
          backgroundColor={isSigningOut ? 'rgba(9, 20, 37, 0.24)' : undefined}
        />
      </NotificationProvider>
    </ChatRealtimeProvider>
  )
}

export default App
