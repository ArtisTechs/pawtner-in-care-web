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
}

export type StatIconName = 'dogs' | 'cats' | 'donation' | 'reports'

export interface StatCardData {
  id: string
  title: string
  value: string
  icon: StatIconName
}

export type ChartRange = 'day' | 'week' | 'month'

export interface ChartFilterOption {
  value: ChartRange
  label: string
}

export interface ReportChartPoint {
  label: string
  value: number
}

export interface DonationChartPoint {
  label: string
  dogs: number
  cats: number
}

export interface HeaderProfile {
  name: string
  role: string
  avatarSrc?: string | null
}
