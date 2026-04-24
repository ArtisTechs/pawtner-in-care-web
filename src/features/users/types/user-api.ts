export type UserRole = 'ADMIN' | 'USER' | (string & {})

export type UserSortBy =
  | 'id'
  | 'firstName'
  | 'middleName'
  | 'lastName'
  | 'email'
  | 'profilePicture'
  | 'active'
  | 'createdDate'
  | 'updatedDate'
export type UserSortDirection = 'asc' | 'desc'

export type UserRoleValue =
  | UserRole
  | {
      label?: string | null
      name?: string | null
      title?: string | null
    }
  | null
  | undefined

export interface UserPayload {
  email: string
  firstName: string
  lastName: string
  middleName?: string | null
  password?: string
  profilePicture?: string | null
  role?: UserRole
}

export interface User {
  active?: boolean | null
  createdAt?: string | null
  createdDate?: string | null
  email?: string | null
  firstName?: string | null
  id: string
  lastName?: string | null
  middleName?: string | null
  profilePicture?: string | null
  role?: UserRoleValue
  shelter?:
    | {
        id?: string | null
        name?: string | null
      }
    | string
    | null
  shelterId?: string | null
  updatedAt?: string | null
  updatedDate?: string | null
}
