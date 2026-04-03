export type SidebarItemKey =
  | 'dashboard'
  | 'inbox'
  | 'pet-list'
  | 'user-list'
  | 'adoption-logs'
  | 'donation-campaign-list'
  | 'donation-logs'
  | 'payment-mode-list'
  | 'calendar'
  | 'to-do'
  | 'contact'
  | 'settings'
  | 'logout'

export type SidebarIconName =
  | 'dashboard'
  | 'inbox'
  | 'pet-list'
  | 'user-list'
  | 'adoption-logs'
  | 'donation-campaign-list'
  | 'donation-logs'
  | 'payment-mode-list'
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
