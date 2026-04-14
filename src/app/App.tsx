import AppRouter from '@/app/routes/AppRouter'
import { useAuthSession } from '@/app/hooks/useAuthSession'
import ChatRealtimeProvider from '@/features/chat/providers/ChatRealtimeProvider'
import NotificationProvider from '@/features/notifications/providers/NotificationProvider'
import FullScreenLoader from '@/shared/components/ui/FullScreenLoader/FullScreenLoader'

function App() {
  const {
    defaultRoute,
    isAuthenticated,
    isHydrating,
    isSigningOut,
    onLogout,
    onSignInSuccess,
    session,
  } = useAuthSession()

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
          visible={isSigningOut}
          subtitle="Signing you out..."
          backgroundColor="rgba(9, 20, 37, 0.24)"
        />
      </NotificationProvider>
    </ChatRealtimeProvider>
  )
}

export default App
