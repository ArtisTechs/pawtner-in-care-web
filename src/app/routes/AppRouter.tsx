import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { APP_ROUTES } from '@/app/routes/route-paths'
import type { AuthSession } from '@/features/auth/types/auth-api'
import SignInPage from '@/features/auth/pages/SignInPage'
import SignUpPage from '@/features/auth/pages/SignUpPage'
import AdoptionRequestListPage from '@/features/adoption-requests/pages/AdoptionRequestListPage'
import AchievementListPage from '@/features/achievements/pages/AchievementListPage'
import AchievementAssignmentPage from '@/features/achievements/pages/AchievementAssignmentPage'
import HeroesWallPage from '@/features/achievements/pages/HeroesWallPage'
import CommunityListingPage from '@/features/community-listing/pages/CommunityListingPage'
import CompanySettingsPage from '@/features/company-settings/pages/CompanySettingsPage'
import DashboardPage from '@/features/dashboard/pages/DashboardPage'
import DonationCampaignListPage from '@/features/donation-campaigns/pages/DonationCampaignListPage'
import DonationTransactionListPage from '@/features/donation-transactions/pages/DonationTransactionListPage'
import EmergencySosListPage from '@/features/emergency-sos/pages/EmergencySosListPage'
import GiftLogListPage from '@/features/gift-logs/pages/GiftLogListPage'
import NotificationPage from '@/features/notifications/pages/NotificationPage'
import EventListPage from '@/features/events/pages/EventListPage'
import EventsCalendarPage from '@/features/events-calendar/pages/EventsCalendarPage'
import ChatConversationPage from '@/features/chat/pages/ChatConversationPage'
import InboxPage from '@/features/chat/pages/InboxPage'
import ItemListingPage from '@/features/item-listings/pages/ItemListingPage'
import PaymentModeListPage from '@/features/payment-modes/pages/PaymentModeListPage'
import PetListPage from '@/features/pets/pages/PetListPage'
import UserListPage from '@/features/users/pages/UserListPage'
import VeterinaryClinicListPage from '@/features/veterinary-clinics/pages/VeterinaryClinicListPage'
import VolunteerListPage from '@/features/volunteers/pages/VolunteerListPage'
import ToDoListPage from '@/features/todos/pages/ToDoListPage'

type AppRouterProps = {
  defaultRoute: string
  isAuthenticated: boolean
  onLogout: () => void
  onSignInSuccess: (session: AuthSession) => void
  session: AuthSession | null
}

function AppRouter({
  defaultRoute,
  isAuthenticated,
  onLogout,
  onSignInSuccess,
  session,
}: AppRouterProps) {
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
              <SignInPage onSignInSuccess={onSignInSuccess} />
            )
          }
        />

        <Route
          path={APP_ROUTES.signUp}
          element={
            isAuthenticated ? <Navigate to={APP_ROUTES.dashboard} replace /> : <SignUpPage />
          }
        />

        <Route
          path={APP_ROUTES.inbox}
          element={
            isAuthenticated ? (
              <InboxPage session={session} onLogout={onLogout} />
            ) : (
              <Navigate to={APP_ROUTES.login} replace />
            )
          }
        />

        <Route
          path={APP_ROUTES.inboxConversation}
          element={
            isAuthenticated ? (
              <ChatConversationPage session={session} onLogout={onLogout} />
            ) : (
              <Navigate to={APP_ROUTES.login} replace />
            )
          }
        />

        <Route
          path={APP_ROUTES.dashboard}
          element={
            isAuthenticated ? (
              <DashboardPage session={session} onLogout={onLogout} />
            ) : (
              <Navigate to={APP_ROUTES.login} replace />
            )
          }
        />

        <Route
          path={APP_ROUTES.petList}
          element={
            isAuthenticated ? (
              <PetListPage session={session} onLogout={onLogout} />
            ) : (
              <Navigate to={APP_ROUTES.login} replace />
            )
          }
        />

        <Route
          path={APP_ROUTES.notifications}
          element={
            isAuthenticated ? (
              <NotificationPage session={session} onLogout={onLogout} />
            ) : (
              <Navigate to={APP_ROUTES.login} replace />
            )
          }
        />

        <Route
          path={APP_ROUTES.veterinaryClinicList}
          element={
            isAuthenticated ? (
              <VeterinaryClinicListPage session={session} onLogout={onLogout} />
            ) : (
              <Navigate to={APP_ROUTES.login} replace />
            )
          }
        />

        <Route
          path={APP_ROUTES.itemListing}
          element={
            isAuthenticated ? (
              <ItemListingPage session={session} onLogout={onLogout} />
            ) : (
              <Navigate to={APP_ROUTES.login} replace />
            )
          }
        />

        <Route
          path={APP_ROUTES.paymentModeList}
          element={
            isAuthenticated ? (
              <PaymentModeListPage session={session} onLogout={onLogout} />
            ) : (
              <Navigate to={APP_ROUTES.login} replace />
            )
          }
        />

        <Route
          path={APP_ROUTES.userList}
          element={
            isAuthenticated ? (
              <UserListPage session={session} onLogout={onLogout} />
            ) : (
              <Navigate to={APP_ROUTES.login} replace />
            )
          }
        />

        <Route
          path={APP_ROUTES.toDoList}
          element={
            isAuthenticated ? (
              <ToDoListPage session={session} onLogout={onLogout} />
            ) : (
              <Navigate to={APP_ROUTES.login} replace />
            )
          }
        />

        <Route
          path={APP_ROUTES.adoptionRequests}
          element={
            isAuthenticated ? (
              <AdoptionRequestListPage session={session} onLogout={onLogout} />
            ) : (
              <Navigate to={APP_ROUTES.login} replace />
            )
          }
        />

        <Route
          path={APP_ROUTES.achievements}
          element={
            isAuthenticated ? (
              <AchievementListPage session={session} onLogout={onLogout} />
            ) : (
              <Navigate to={APP_ROUTES.login} replace />
            )
          }
        />

        <Route
          path={APP_ROUTES.achievementAssignment}
          element={
            isAuthenticated ? (
              <AchievementAssignmentPage session={session} onLogout={onLogout} />
            ) : (
              <Navigate to={APP_ROUTES.login} replace />
            )
          }
        />

        <Route
          path={APP_ROUTES.heroesWall}
          element={
            isAuthenticated ? (
              <HeroesWallPage session={session} onLogout={onLogout} />
            ) : (
              <Navigate to={APP_ROUTES.login} replace />
            )
          }
        />

        <Route
          path={APP_ROUTES.donationLogs}
          element={
            isAuthenticated ? (
              <DonationTransactionListPage session={session} onLogout={onLogout} />
            ) : (
              <Navigate to={APP_ROUTES.login} replace />
            )
          }
        />

        <Route
          path={APP_ROUTES.giftLogs}
          element={
            isAuthenticated ? (
              <GiftLogListPage session={session} onLogout={onLogout} />
            ) : (
              <Navigate to={APP_ROUTES.login} replace />
            )
          }
        />

        <Route
          path={APP_ROUTES.donationList}
          element={
            isAuthenticated ? (
              <DonationCampaignListPage session={session} onLogout={onLogout} />
            ) : (
              <Navigate to={APP_ROUTES.login} replace />
            )
          }
        />

        <Route
          path={APP_ROUTES.emergencySos}
          element={
            isAuthenticated ? (
              <EmergencySosListPage session={session} onLogout={onLogout} />
            ) : (
              <Navigate to={APP_ROUTES.login} replace />
            )
          }
        />

        <Route
          path={APP_ROUTES.eventList}
          element={
            isAuthenticated ? (
              <EventListPage session={session} onLogout={onLogout} />
            ) : (
              <Navigate to={APP_ROUTES.login} replace />
            )
          }
        />

        <Route
          path={APP_ROUTES.volunteerList}
          element={
            isAuthenticated ? (
              <VolunteerListPage session={session} onLogout={onLogout} />
            ) : (
              <Navigate to={APP_ROUTES.login} replace />
            )
          }
        />

        <Route
          path={APP_ROUTES.communityListing}
          element={
            isAuthenticated ? (
              <CommunityListingPage session={session} onLogout={onLogout} />
            ) : (
              <Navigate to={APP_ROUTES.login} replace />
            )
          }
        />

        <Route
          path={APP_ROUTES.companySettings}
          element={
            isAuthenticated ? (
              <CompanySettingsPage session={session} onLogout={onLogout} />
            ) : (
              <Navigate to={APP_ROUTES.login} replace />
            )
          }
        />

        <Route
          path={APP_ROUTES.calendar}
          element={
            isAuthenticated ? (
              <EventsCalendarPage session={session} onLogout={onLogout} />
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

export default AppRouter
