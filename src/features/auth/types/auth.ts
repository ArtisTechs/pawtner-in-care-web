export type AuthFieldType = 'email' | 'password' | 'text'

export type SignInTextFieldName = 'email' | 'password'
export type ForgotPasswordFieldName = 'email' | 'otp' | 'newPassword' | 'confirmPassword'
export type ForgotPasswordStep = 'request-otp' | 'verify-otp' | 'reset-password' | 'completed'
export type AuthView = 'sign-in' | 'forgot-password'

export interface SignInFormState {
  email: string
  password: string
}

export interface ForgotPasswordFormState {
  email: string
  otp: string
  newPassword: string
  confirmPassword: string
}

export interface SignInTextFieldConfig {
  id: string
  name: SignInTextFieldName
  label: string
  type: AuthFieldType
  placeholder: string
  actionText?: string
  actionPlacement?: 'inline' | 'below'
}

export interface ForgotPasswordFieldConfig {
  id: string
  name: ForgotPasswordFieldName
  label: string
  type: AuthFieldType
  placeholder: string
  actionText?: string
  actionPlacement?: 'inline' | 'below'
}
