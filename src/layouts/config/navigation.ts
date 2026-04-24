import titleLogo from '@/assets/title-logo.png'
import { APP_ROUTES } from '@/app/routes/route-paths'
import type { DashboardAccessRole } from '@/features/auth/utils/auth-utils'
import type { HeaderProfile, SidebarItemKey, SidebarMenuItem } from '@/shared/types/layout'

export const sidebarLogo = titleLogo

export const defaultHeaderProfile: HeaderProfile = {
  name: 'Lea Ibunan',
  role: 'Admin',
}

export const sidebarMenuItems: SidebarMenuItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', path: APP_ROUTES.dashboard },
  { key: 'inbox', label: 'Inbox', icon: 'inbox', path: APP_ROUTES.inbox },
  { key: 'pet-list', label: 'Pet List', icon: 'pet-list', path: APP_ROUTES.petList },
  {
    key: 'veterinary-clinic-list',
    label: 'Veterinary Clinics',
    icon: 'veterinary-clinic-list',
    path: APP_ROUTES.veterinaryClinicList,
  },
  { key: 'user-list', label: 'User List', icon: 'user-list', path: APP_ROUTES.userList },
  {
    key: 'shelter-list',
    label: 'Shelter Management',
    icon: 'shelter-list',
    path: APP_ROUTES.shelterList,
  },
  {
    key: 'shelter-association',
    label: 'Shelter Association',
    icon: 'shelter-association',
    path: APP_ROUTES.shelterAssociation,
  },
  { key: 'adoption-logs', label: 'Pet Logs', icon: 'adoption-logs', path: APP_ROUTES.adoptionRequests },
  { key: 'emergency-sos', label: 'Emergency SOS', icon: 'emergency-sos', path: APP_ROUTES.emergencySos },
  {
    key: 'donation-campaign-list',
    label: 'Donation Campaign List',
    icon: 'donation-campaign-list',
    path: APP_ROUTES.donationList,
  },
  { key: 'donation-logs', label: 'Donation Logs', icon: 'donation-logs', path: APP_ROUTES.donationLogs },
  {
    key: 'achievement-list',
    label: 'Achievements',
    icon: 'achievement-list',
    path: APP_ROUTES.achievements,
  },
  {
    key: 'achievement-assignment',
    label: 'Assign Achievements',
    icon: 'achievement-list',
    path: APP_ROUTES.achievementAssignment,
  },
  {
    key: 'heroes-wall',
    label: 'Heroes Wall',
    icon: 'heroes-wall',
    path: APP_ROUTES.heroesWall,
  },
  {
    key: 'item-listing',
    label: 'Item Listings',
    icon: 'item-listing',
    path: APP_ROUTES.itemListing,
  },
  {
    key: 'gift-logs',
    label: 'Gift Logs',
    icon: 'gift-logs',
    path: APP_ROUTES.giftLogs,
  },
  {
    key: 'payment-mode-list',
    label: 'Payment Methods',
    icon: 'payment-mode-list',
    path: APP_ROUTES.paymentModeList,
  },
  { key: 'events-list', label: 'Event List', icon: 'calendar', path: APP_ROUTES.eventList },
  {
    key: 'volunteer-list',
    label: 'Volunteer List',
    icon: 'volunteer-list',
    path: APP_ROUTES.volunteerList,
  },
  {
    key: 'community-listing',
    label: 'Moderation',
    icon: 'community-listing',
    path: APP_ROUTES.communityListing,
  },
  { key: 'calendar', label: 'Calendar', icon: 'calendar', path: APP_ROUTES.calendar },
  { key: 'to-do', label: 'To-Do', icon: 'to-do', path: APP_ROUTES.toDoList },
]

export const sidebarBottomItems: SidebarMenuItem[] = [
  { key: 'settings', label: 'Shelter Settings', icon: 'settings', path: APP_ROUTES.companySettings },
  { key: 'logout', label: 'Logout', icon: 'logout' },
]

const SYSTEM_ADMIN_MENU_ITEM_KEYS = new Set<SidebarItemKey>([
  'user-list',
  'shelter-list',
  'shelter-association',
])
const SYSTEM_ADMIN_BOTTOM_ITEM_KEYS = new Set<SidebarItemKey>(['settings', 'logout'])

export const resolveSidebarMenuItemsByRole = (
  role: DashboardAccessRole | '',
  items: SidebarMenuItem[] = sidebarMenuItems,
) => {
  if (role === 'SYSTEM_ADMIN') {
    return items.filter((item) => SYSTEM_ADMIN_MENU_ITEM_KEYS.has(item.key))
  }

  return items.filter((item) => item.key !== 'shelter-list' && item.key !== 'shelter-association')
}

export const resolveSidebarBottomItemsByRole = (
  role: DashboardAccessRole | '',
  items: SidebarMenuItem[] = sidebarBottomItems,
) => {
  if (role !== 'SYSTEM_ADMIN') {
    return items
  }

  return items.filter((item) => SYSTEM_ADMIN_BOTTOM_ITEM_KEYS.has(item.key))
}
