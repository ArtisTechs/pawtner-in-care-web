const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CONTACT_NUMBER_PATTERN = /^\+?[0-9]{7,15}$/

export const normalizeContactNumber = (value: string) =>
  value.replace(/[\s()-]/g, '').trim()

export const isValidContactNumber = (value: string) =>
  CONTACT_NUMBER_PATTERN.test(normalizeContactNumber(value))

export const sanitizeContactNumberInput = (value: string) => {
  const trimmedValue = value.trim()
  const hasLeadingPlus = trimmedValue.startsWith('+')
  const digitsOnly = trimmedValue.replace(/\D/g, '').slice(0, 15)

  return `${hasLeadingPlus ? '+' : ''}${digitsOnly}`
}

export const isValidEmail = (value: string) => EMAIL_PATTERN.test(value.trim())
