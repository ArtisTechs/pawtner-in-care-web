export type SidebarItemKey =
  | 'dashboard'
  | 'inbox'
  | 'pet-list'
  | 'adoption-logs'
  | 'donation-logs'
  | 'calendar'
  | 'to-do'
  | 'contact'
  | 'settings'
  | 'logout'

export type SidebarIconName =
  | 'dashboard'
  | 'inbox'
  | 'pet-list'
  | 'adoption-logs'
  | 'donation-logs'
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
