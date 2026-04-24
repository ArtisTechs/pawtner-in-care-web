import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { ReactElement } from 'react'
import { APP_ROUTES } from '@/app/routes/route-paths'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { resolveDashboardAccessRole } from '@/features/auth/utils/auth-utils'
import SignInPage from '@/features/auth/pages/SignInPage'
import SignUpPage from '@/features/auth/pages/SignUpPage'
import AdoptionRequestListPage from '@/features/adoption-requests/pages/AdoptionRequestListPage'
import AchievementListPage from '@/features/achievements/pages/AchievementListPage'
import AchievementAssignmentPage from '@/features/achievements/pages/AchievementAssignmentPage'
import HeroesWallPage from '@/features/achievements/pages/HeroesWallPage'
import CommunityListingPage from '@/features/community-listing/pages/CommunityListingPage'
import CompanySettingsPage from '@/features/company-settings/pages/CompanySettingsPage'
import ProfileSettingsPage from '@/features/profile/pages/ProfileSettingsPage'
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
import ShelterListPage from '@/features/shelters/pages/ShelterListPage'
import ShelterAssociationPage from '@/features/shelters/pages/ShelterAssociationPage'
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

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

function AppRouter({
  defaultRoute,
  isAuthenticated,
  onLogout,
  onSignInSuccess,
  session,
}: AppRouterProps) {
  const resolvedRole = resolveDashboardAccessRole(session)
  const isSystemAdmin = resolvedRole === 'SYSTEM_ADMIN'

  const renderProtectedRoute = (element: ReactElement, allowSystemAdmin = false) => {
    if (!isAuthenticated) {
      return <Navigate to={APP_ROUTES.login} replace />
    }

    if (isSystemAdmin && !allowSystemAdmin) {
      return <Navigate to={APP_ROUTES.userList} replace />
    }

    return element
  }

  const renderSystemAdminRoute = (element: ReactElement) => {
    if (!isAuthenticated) {
      return <Navigate to={APP_ROUTES.login} replace />
    }

    if (!isSystemAdmin) {
      return <Navigate to={APP_ROUTES.dashboard} replace />
    }

    return element
  }

  return (
    <BrowserRouter basename={routerBasename}>
      <Routes>
        <Route path={APP_ROUTES.root} element={<Navigate to={defaultRoute} replace />} />

        <Route
          path={APP_ROUTES.login}
          element={
            isAuthenticated ? (
              <Navigate to={defaultRoute} replace />
            ) : (
              <SignInPage onSignInSuccess={onSignInSuccess} />
            )
          }
        />

        <Route
          path={APP_ROUTES.signUp}
          element={
            isAuthenticated ? <Navigate to={defaultRoute} replace /> : <SignUpPage />
          }
        />

        <Route
          path={APP_ROUTES.inbox}
          element={renderProtectedRoute(<InboxPage session={session} onLogout={onLogout} />)}
        />

        <Route
          path={APP_ROUTES.inboxConversation}
          element={renderProtectedRoute(<ChatConversationPage session={session} onLogout={onLogout} />)}
        />

        <Route
          path={APP_ROUTES.dashboard}
          element={renderProtectedRoute(<DashboardPage session={session} onLogout={onLogout} />)}
        />

        <Route
          path={APP_ROUTES.petList}
          element={renderProtectedRoute(<PetListPage session={session} onLogout={onLogout} />)}
        />

        <Route
          path={APP_ROUTES.notifications}
          element={renderProtectedRoute(<NotificationPage session={session} onLogout={onLogout} />, true)}
        />

        <Route
          path={APP_ROUTES.veterinaryClinicList}
          element={renderProtectedRoute(<VeterinaryClinicListPage session={session} onLogout={onLogout} />)}
        />

        <Route
          path={APP_ROUTES.itemListing}
          element={renderProtectedRoute(<ItemListingPage session={session} onLogout={onLogout} />)}
        />

        <Route
          path={APP_ROUTES.paymentModeList}
          element={renderProtectedRoute(<PaymentModeListPage session={session} onLogout={onLogout} />)}
        />

        <Route
          path={APP_ROUTES.userList}
          element={renderProtectedRoute(<UserListPage session={session} onLogout={onLogout} />, true)}
        />

        <Route
          path={APP_ROUTES.shelterList}
          element={renderSystemAdminRoute(<ShelterListPage session={session} onLogout={onLogout} />)}
        />

        <Route
          path={APP_ROUTES.shelterAssociation}
          element={renderSystemAdminRoute(<ShelterAssociationPage session={session} onLogout={onLogout} />)}
        />

        <Route
          path={APP_ROUTES.toDoList}
          element={renderProtectedRoute(<ToDoListPage session={session} onLogout={onLogout} />)}
        />

        <Route
          path={APP_ROUTES.adoptionRequests}
          element={renderProtectedRoute(<AdoptionRequestListPage session={session} onLogout={onLogout} />)}
        />

        <Route
          path={APP_ROUTES.achievements}
          element={renderProtectedRoute(<AchievementListPage session={session} onLogout={onLogout} />)}
        />

        <Route
          path={APP_ROUTES.achievementAssignment}
          element={renderProtectedRoute(<AchievementAssignmentPage session={session} onLogout={onLogout} />)}
        />

        <Route
          path={APP_ROUTES.heroesWall}
          element={renderProtectedRoute(<HeroesWallPage session={session} onLogout={onLogout} />)}
        />

        <Route
          path={APP_ROUTES.donationLogs}
          element={renderProtectedRoute(<DonationTransactionListPage session={session} onLogout={onLogout} />)}
        />

        <Route
          path={APP_ROUTES.giftLogs}
          element={renderProtectedRoute(<GiftLogListPage session={session} onLogout={onLogout} />)}
        />

        <Route
          path={APP_ROUTES.donationList}
          element={renderProtectedRoute(<DonationCampaignListPage session={session} onLogout={onLogout} />)}
        />

        <Route
          path={APP_ROUTES.emergencySos}
          element={renderProtectedRoute(<EmergencySosListPage session={session} onLogout={onLogout} />)}
        />

        <Route
          path={APP_ROUTES.eventList}
          element={renderProtectedRoute(<EventListPage session={session} onLogout={onLogout} />)}
        />

        <Route
          path={APP_ROUTES.volunteerList}
          element={renderProtectedRoute(<VolunteerListPage session={session} onLogout={onLogout} />)}
        />

        <Route
          path={APP_ROUTES.communityListing}
          element={renderProtectedRoute(<CommunityListingPage session={session} onLogout={onLogout} />)}
        />

        <Route
          path={APP_ROUTES.companySettings}
          element={renderProtectedRoute(<CompanySettingsPage session={session} onLogout={onLogout} />, true)}
        />

        <Route
          path={APP_ROUTES.profileSettings}
          element={renderProtectedRoute(<ProfileSettingsPage session={session} onLogout={onLogout} />, true)}
        />

        <Route
          path={APP_ROUTES.calendar}
          element={renderProtectedRoute(<EventsCalendarPage session={session} onLogout={onLogout} />)}
        />

        <Route path="*" element={<Navigate to={defaultRoute} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default AppRouter
