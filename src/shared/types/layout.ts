export type SidebarItemKey =
  | 'dashboard'
  | 'inbox'
  | 'notification'
  | 'pet-list'
  | 'veterinary-clinic-list'
  | 'user-list'
  | 'adoption-logs'
  | 'emergency-sos'
  | 'donation-campaign-list'
  | 'donation-logs'
  | 'gift-logs'
  | 'achievement-list'
  | 'achievement-assignment'
  | 'heroes-wall'
  | 'item-listing'
  | 'events-list'
  | 'volunteer-list'
  | 'payment-mode-list'
  | 'community-listing'
  | 'calendar'
  | 'to-do'
  | 'settings'
  | 'logout'

export type SidebarIconName =
  | 'dashboard'
  | 'inbox'
  | 'notification'
  | 'pet-list'
  | 'veterinary-clinic-list'
  | 'user-list'
  | 'adoption-logs'
  | 'emergency-sos'
  | 'donation-campaign-list'
  | 'donation-logs'
  | 'gift-logs'
  | 'achievement-list'
  | 'heroes-wall'
  | 'item-listing'
  | 'events-list'
  | 'volunteer-list'
  | 'payment-mode-list'
  | 'community-listing'
  | 'calendar'
  | 'to-do'
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
