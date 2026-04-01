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
  { key: 'adoption-logs', label: 'Adoption Requests', icon: 'adoption-logs', path: APP_ROUTES.adoptionRequests },
  { key: 'donation-logs', label: 'Donation List', icon: 'donation-logs', path: APP_ROUTES.donationList },
  { key: 'calendar', label: 'Calendar', icon: 'calendar' },
  { key: 'to-do', label: 'To-Do', icon: 'to-do' },
  { key: 'contact', label: 'Contact', icon: 'contact' },
]

export const sidebarBottomItems: SidebarMenuItem[] = [
  { key: 'settings', label: 'Settings', icon: 'settings' },
  { key: 'logout', label: 'Logout', icon: 'logout' },
]
