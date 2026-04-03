import titleLogo from '@/assets/title-logo.png'
import { APP_ROUTES } from '@/app/routes/route-paths'
import type { HeaderProfile, SidebarMenuItem } from '@/shared/types/layout'

export const sidebarLogo = titleLogo

export const defaultHeaderProfile: HeaderProfile = {
  name: 'Lea Ibunan',
  role: 'Admin',
}

export const sidebarMenuItems: SidebarMenuItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', path: APP_ROUTES.dashboard },
  { key: 'inbox', label: 'Inbox', icon: 'inbox' },
  { key: 'pet-list', label: 'Pet List', icon: 'pet-list', path: APP_ROUTES.petList },
  { key: 'user-list', label: 'User List', icon: 'user-list', path: APP_ROUTES.userList },
  { key: 'adoption-logs', label: 'Adoption Logs', icon: 'adoption-logs', path: APP_ROUTES.adoptionRequests },
  {
    key: 'donation-campaign-list',
    label: 'Donation Campaign List',
    icon: 'donation-campaign-list',
    path: APP_ROUTES.donationList,
  },
  { key: 'donation-logs', label: 'Donation Logs', icon: 'donation-logs', path: APP_ROUTES.donationLogs },
  {
    key: 'payment-mode-list',
    label: 'Payment Methods',
    icon: 'payment-mode-list',
    path: APP_ROUTES.paymentModeList,
  },
  { key: 'calendar', label: 'Calendar', icon: 'calendar' },
  { key: 'to-do', label: 'To-Do', icon: 'to-do' },
  { key: 'contact', label: 'Contact', icon: 'contact' },
]

export const sidebarBottomItems: SidebarMenuItem[] = [
  { key: 'settings', label: 'Settings', icon: 'settings' },
  { key: 'logout', label: 'Logout', icon: 'logout' },
]
