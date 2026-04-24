import type { AddUserForm } from '@/features/users/constants/user-list.constants'
import type { User, UserPayload, UserRole, UserRoleValue } from '@/features/users/types/user-api'
import { toTitleCase } from '@/shared/lib/text/title-case'

const normalizeOptional = (value: string) => {
  const trimmedValue = value.trim()
  return trimmedValue || undefined
}

export const mapUserToForm = (user: User): AddUserForm => ({
  email: user.email?.trim() ?? '',
  firstName: user.firstName?.trim() ?? '',
  lastName: user.lastName?.trim() ?? '',
  middleName: user.middleName?.trim() ?? '',
  password: '',
  profilePicture: user.profilePicture?.trim() ?? '',
  role: resolveUserRoleValue(user.role),
})

export const buildUserPayload = (form: AddUserForm, isEditing: boolean): UserPayload => {
  const payload: UserPayload = {
    email: form.email.trim(),
    firstName: toTitleCase(form.firstName).trim(),
    lastName: toTitleCase(form.lastName).trim(),
    middleName: normalizeOptional(toTitleCase(form.middleName)),
    profilePicture: normalizeOptional(form.profilePicture),
    role: resolveUserRoleValue(form.role),
  }

  const trimmedPassword = form.password.trim()
  if (trimmedPassword || !isEditing) {
    payload.password = trimmedPassword
  }

  return payload
}

export const resolveUserRoleValue = (role: UserRoleValue): UserRole => {
  if (!role) {
    return 'USER'
  }

  if (typeof role === 'string') {
    const normalizedRole = role.trim().toUpperCase()
    if (!normalizedRole) {
      return 'USER'
    }

    return normalizedRole
  }

  const firstRoleSource = role.name ?? role.label ?? role.title ?? ''
  const normalizedRole = firstRoleSource.trim().toUpperCase()
  return normalizedRole || 'USER'
}

export const resolveUserRoleLabel = (role: UserRoleValue) => {
  const roleValue = resolveUserRoleValue(role)
  if (roleValue === 'ADMIN') {
    return 'Admin'
  }

  if (roleValue === 'SYSTEM_ADMIN') {
    return 'System Admin'
  }

  if (roleValue === 'USER') {
    return 'User'
  }

  return roleValue
}

export const resolveUserDisplayName = (
  user: Pick<User, 'firstName' | 'middleName' | 'lastName'>,
) => {
  return [user.firstName, user.middleName, user.lastName]
    .map((value) => value?.trim() ?? '')
    .filter(Boolean)
    .join(' ')
}

export const resolveUserFullName = (user: Pick<User, 'firstName' | 'middleName' | 'lastName' | 'email'>) => {
  const fullName = resolveUserDisplayName(user)

  if (fullName) {
    return fullName
  }

  return user.email?.trim() || 'N/A'
}
