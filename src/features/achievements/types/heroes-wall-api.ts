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
  id: string
  points: number
  profileLink?: string | null
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

export interface HeroAchievementDefinition {
  category?: string | null
  code?: string | null
  description?: string | null
  iconUrl?: string | null
  id: string
  points: number
  rarity?: string | null
  title: string
}

export interface HeroAchievement {
  achievement: HeroAchievementDefinition
  createdAt?: string | null
  id: string
  isUnlocked: boolean
  progressCurrent: number
  progressTarget: number
  sourceEvent?: string | null
  unlockedAt?: string | null
  updatedAt?: string | null
  userId: string
}

export interface HeroUserDetails {
  achievements: HeroAchievement[]
  email?: string | null
  firstName?: string | null
  id: string
  lastName?: string | null
  middleName?: string | null
  profileLink?: string | null
  profilePicture?: string | null
  totalPoints: number
}
