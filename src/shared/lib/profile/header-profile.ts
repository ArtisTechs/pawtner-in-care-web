import type { HeaderProfile } from '@/shared/types/layout'

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object'

export const getStringField = (value: unknown, keys: string[]) => {
  if (!isRecord(value)) {
    return ''
  }

  for (const key of keys) {
    const candidate = value[key]

    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }

  return ''
}

export const getUserIdFromUnknownUser = (value: unknown) => {
  return getStringField(value, ['id', 'userId'])
}

export const resolveProfilePatch = (value: unknown): Partial<HeaderProfile> => {
  const name =
    getStringField(value, ['name', 'fullName', 'fullname', 'displayName']) ||
    [getStringField(value, ['firstName', 'firstname']), getStringField(value, ['lastName', 'lastname'])]
      .filter(Boolean)
      .join(' ')
      .trim()

  const role =
    getStringField(value, ['role', 'userRole', 'userType']) ||
    (isRecord(value) ? getStringField(value.role, ['name', 'label', 'title']) : '')

  const avatarSrc = getStringField(value, [
    'avatarSrc',
    'avatar',
    'photoUrl',
    'photoURL',
    'profileImage',
    'image',
  ])

  const patch: Partial<HeaderProfile> = {}

  if (name) {
    patch.name = name
  }

  if (role) {
    patch.role = role
  }

  if (avatarSrc) {
    patch.avatarSrc = avatarSrc
  }

  return patch
}
