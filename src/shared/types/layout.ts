export type SidebarItemKey =
  | 'dashboard'
  | 'inbox'
  | 'pet-list'
  | 'veterinary-clinic-list'
  | 'user-list'
  | 'adoption-logs'
  | 'emergency-sos'
  | 'donation-campaign-list'
  | 'donation-logs'
  | 'achievement-list'
  | 'achievement-assignment'
  | 'heroes-wall'
  | 'events-list'
  | 'volunteer-list'
  | 'payment-mode-list'
  | 'community-listing'
  | 'calendar'
  | 'to-do'
  | 'contact'
  | 'settings'
  | 'logout'

export type SidebarIconName =
  | 'dashboard'
  | 'inbox'
  | 'pet-list'
  | 'veterinary-clinic-list'
  | 'user-list'
  | 'adoption-logs'
  | 'emergency-sos'
  | 'donation-campaign-list'
  | 'donation-logs'
  | 'achievement-list'
  | 'heroes-wall'
  | 'events-list'
  | 'volunteer-list'
  | 'payment-mode-list'
  | 'community-listing'
  | 'calendar'
  | 'to-do'
  | 'contact'
  | 'settings'
  | 'logout'

export interface SidebarMenuItem {
  key: SidebarItemKey
  label: string
  icon: SidebarIconName
  path?: string
}

export interface HeaderProfile {
  name: string
  role: string
  avatarSrc?: string | null
}
