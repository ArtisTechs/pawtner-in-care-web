export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 255
export const PASSWORD_COMPLEXITY_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/

export const getPasswordValidationError = (password: string): string | null => {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters long.`
  }

  if (!PASSWORD_COMPLEXITY_PATTERN.test(password)) {
    return 'Password must include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.'
  }

  return null
}
