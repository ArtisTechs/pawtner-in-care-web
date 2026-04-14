export type AchievementCategory =
  | 'REGISTRATION'
  | 'DONATION_LOGS'
  | 'ADOPTION_LOGS'
  | 'EMERGENCY_SOS'
  | 'COMMUNITY'
  | 'ACCOUNT_DAYS'
  | 'GIFT_LOGS'
  | (string & {})

export type AchievementRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | (string & {})

export type AchievementAssignmentType = 'AUTO' | 'MANUAL' | (string & {})

export type AchievementSortDir = 'asc' | 'desc'

export interface Achievement {
  assignmentType?: AchievementAssignmentType | null
  category?: AchievementCategory | null
  code?: string | null
  createdAt?: string | null
  createdDate?: string | null
  description?: string | null
  iconUrl?: string | null
  id: string
  isActive?: boolean | null
  points?: number | string | null
  requiredValue?: number | string | null
  rarity?: AchievementRarity | null
  title?: string | null
  updatedAt?: string | null
  updatedDate?: string | null
}

export interface AchievementListQuery {
  assignmentType?: AchievementAssignmentType
  category?: AchievementCategory
  code?: string
  ignorePagination?: boolean
  isActive?: boolean
  page?: number
  rarity?: AchievementRarity
  search?: string
  size?: number
  sortBy?: string
  sortDir?: AchievementSortDir
  title?: string
}

export interface AchievementListResult {
  isFirst: boolean
  isLast: boolean
  items: Achievement[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface CreateAchievementPayload {
  assignmentType: AchievementAssignmentType
  category?: AchievementCategory
  code: string
  description: string
  iconUrl: string | null
  isActive: boolean
  points: number
  requiredValue?: number | null
  rarity: AchievementRarity
  title: string
}

export interface ManualAchievementAssignmentPayload {
  achievementCode?: string
  achievementId?: string
  metadata?: string | null
  userId: string
}

export interface ManualAchievementAssignmentResponse {
  achievementCode?: string | null
  achievementId?: string | null
  id?: string | null
  metadata?: string | null
  unlockedAt?: string | null
  userId?: string | null
}
