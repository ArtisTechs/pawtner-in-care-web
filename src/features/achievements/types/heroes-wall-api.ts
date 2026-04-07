export type HeroesWallPeriod = 'WEEKLY' | 'MONTHLY' | 'ALL_TIME'

export interface HeroesWallListQuery {
  page?: number
  period?: HeroesWallPeriod
  size?: number
}

export interface HeroesWallEntry {
  avatarUrl?: string | null
  badgeCount: number
  displayName: string
  donatedAmount: number
  id: string
  points: number
  rank: number
  userId: string
}

export interface HeroesWallListResult {
  isFirst: boolean
  isLast: boolean
  items: HeroesWallEntry[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}
