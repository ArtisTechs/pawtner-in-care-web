export type AchievementCategory =
  | 'REGISTRATION'
  | 'ADOPTION'
  | 'DONATION'
  | 'ENGAGEMENT'
  | (string & {})

export type AchievementRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | (string & {})

export type AchievementVisibility = 'PUBLIC' | 'PRIVATE' | (string & {})

export type AchievementAssignmentType = 'AUTO' | 'MANUAL' | (string & {})

export type AchievementTriggerType =
  | 'USER_REGISTERED'
  | 'PET_ADOPTED'
  | 'DONATION_MADE'
  | 'USER_ACTIVE_MONTH'
  | 'MANUAL'
  | (string & {})

export type AchievementRuleType =
  | 'FIRST_ACTION'
  | 'COUNT_THRESHOLD'
  | 'STREAK'
  | 'BOOLEAN_ACTION'
  | (string & {})

export type AchievementSortDir = 'asc' | 'desc'

export interface Achievement {
  assignmentType?: AchievementAssignmentType | null
  category?: AchievementCategory | null
  code?: string | null
  createdAt?: string | null
  createdDate?: string | null
  description?: string | null
  endAt?: string | null
  iconUrl?: string | null
  id: string
  isActive?: boolean | null
  isRepeatable?: boolean | null
  points?: number | string | null
  rarity?: AchievementRarity | null
  ruleConfig?: string | null
  ruleType?: AchievementRuleType | null
  startAt?: string | null
  title?: string | null
  triggerType?: AchievementTriggerType | null
  updatedAt?: string | null
  updatedDate?: string | null
  visibility?: AchievementVisibility | null
}

export interface AchievementListQuery {
  assignmentType?: AchievementAssignmentType
  category?: AchievementCategory
  code?: string
  endAtFrom?: string
  endAtTo?: string
  ignorePagination?: boolean
  isActive?: boolean
  isRepeatable?: boolean
  page?: number
  rarity?: AchievementRarity
  ruleType?: AchievementRuleType
  search?: string
  size?: number
  sortBy?: string
  sortDir?: AchievementSortDir
  startAtFrom?: string
  startAtTo?: string
  title?: string
  triggerType?: AchievementTriggerType
  visibility?: AchievementVisibility
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
  category: AchievementCategory
  code: string
  description: string
  endAt: string | null
  iconUrl: string | null
  isActive: boolean
  isRepeatable: boolean
  points: number
  rarity: AchievementRarity
  ruleConfig: string | null
  ruleType: AchievementRuleType
  startAt: string | null
  title: string
  triggerType: AchievementTriggerType
  visibility: AchievementVisibility
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
