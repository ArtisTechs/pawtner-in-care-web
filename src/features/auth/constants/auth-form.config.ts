import type {
  ForgotPasswordFieldConfig,
  ForgotPasswordFormState,
  ForgotPasswordStep,
  SignInFormState,
  SignInTextFieldConfig,
} from '@/features/auth/types/auth'

export const SIGN_IN_FIELDS: SignInTextFieldConfig[] = [
  {
    id: 'email',
    name: 'email',
    label: 'Email address:',
    type: 'email',
    placeholder: 'brillanteskurtmitchel@gmail.com',
  },
  {
    id: 'password',
    name: 'password',
    label: 'Password',
    type: 'password',
    placeholder: '........',
    actionText: 'Forget Password?',
    actionPlacement: 'below',
  },
]

export const REQUEST_OTP_FIELDS: ForgotPasswordFieldConfig[] = [
  {
    id: 'forgot-email',
    name: 'email',
    label: 'Email address:',
    type: 'email',
    placeholder: 'brillanteskurtmitchel@gmail.com',
  },
]

export const VERIFY_OTP_FIELDS: ForgotPasswordFieldConfig[] = [
  {
    id: 'forgot-otp',
    name: 'otp',
    label: 'OTP code:',
    type: 'text',
    placeholder: 'Enter the OTP sent to your email',
  },
]

export const RESET_PASSWORD_FIELDS: ForgotPasswordFieldConfig[] = [
  {
    id: 'forgot-new-password',
    name: 'newPassword',
    label: 'New password:',
    type: 'password',
    placeholder: 'Enter your new password',
  },
  {
    id: 'forgot-confirm-password',
    name: 'confirmPassword',
    label: 'Confirm password:',
    type: 'password',
    placeholder: 'Re-enter your new password',
  },
]

export const FORGOT_PASSWORD_COPY: Record<
  ForgotPasswordStep,
  { heading: string; subheading: string; submitLabel: string }
> = {
  'request-otp': {
    heading: 'Forgot Password',
    subheading: 'Enter your email address and we will send you a one-time OTP code.',
    submitLabel: 'Send OTP',
  },
  'verify-otp': {
    heading: 'Verify OTP',
    subheading: 'Enter the OTP code from your email to continue.',
    submitLabel: 'Verify OTP',
  },
  'reset-password': {
    heading: 'Reset Password',
    subheading: 'Set your new password to complete account recovery.',
    submitLabel: 'Reset Password',
  },
  completed: {
    heading: 'Password Updated',
    subheading: 'Your password has been reset successfully. You can now sign in.',
    submitLabel: 'Back to Sign In',
  },
}

export const INITIAL_SIGN_IN_FORM: SignInFormState = {
  email: '',
  password: '',
}

export const INITIAL_FORGOT_PASSWORD_FORM: ForgotPasswordFormState = {
  email: '',
  otp: '',
  newPassword: '',
  confirmPassword: '',
}
