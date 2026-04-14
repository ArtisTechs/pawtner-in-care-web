import type { UserRole, UserSortBy, UserSortDirection } from '@/features/users/types/user-api'

export const LIST_INITIAL_BATCH_SIZE = 12
export const LIST_BATCH_SIZE = 12
export const LIST_SKELETON_ROW_COUNT = 8

export const DEFAULT_LIST_SORT_BY: UserSortBy = 'lastName'
export const DEFAULT_LIST_SORT_DIR: UserSortDirection = 'asc'
export const DEFAULT_LIST_PAGE = 0
export const DEFAULT_LIST_SIZE = 100

export const USER_ROLE_OPTIONS: UserRole[] = ['ADMIN', 'USER']
export type UserRoleFilter = 'ALL' | 'ADMIN' | 'USER'
export type UserStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'

export const USER_ROLE_FILTER_OPTIONS: UserRoleFilter[] = ['ALL', 'ADMIN', 'USER']
export const USER_STATUS_FILTER_OPTIONS: UserStatusFilter[] = ['ALL', 'ACTIVE', 'INACTIVE']

export interface AddUserForm {
  email: string
  firstName: string
  lastName: string
  middleName: string
  password: string
  profilePicture: string
  role: UserRole
}

export const DEFAULT_ADD_USER_FORM: AddUserForm = {
  email: '',
  firstName: '',
  lastName: '',
  middleName: '',
  password: '',
  profilePicture: '',
  role: 'USER',
}
