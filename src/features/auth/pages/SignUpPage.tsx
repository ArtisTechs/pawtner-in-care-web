import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import titleLogo from '@/assets/title-logo.png'
import { APP_ROUTES } from '@/app/routes/route-paths'
import AuthTextField from '@/features/auth/components/AuthTextField'
import OtpCodeField from '@/features/auth/components/OtpCodeField'
import { authService } from '@/features/auth/services/auth.service'
import type { SignUpPayload } from '@/features/auth/types/auth-api'
import { formatCountdownTime, getOtpResendCooldownSeconds } from '@/features/auth/utils/auth-utils'
import { getErrorMessage } from '@/shared/api/api-error'
import Toast from '@/shared/components/feedback/Toast'
import FullScreenLoader from '@/shared/components/ui/FullScreenLoader/FullScreenLoader'
import { useToast } from '@/shared/hooks/useToast'
import { isValidEmail } from '@/shared/lib/validation/contact'
import styles from './SignUpPage.module.css'

type SignUpStep = 'details' | 'verify-otp' | 'completed'
type SignUpFieldName =
  | 'firstName'
  | 'middleName'
  | 'lastName'
  | 'email'
  | 'password'
  | 'confirmPassword'
  | 'otp'
type SignUpTextFieldName = Exclude<SignUpFieldName, 'otp'>

interface SignUpFormState {
  firstName: string
  middleName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
  otp: string
}

type SignUpFieldErrors = Partial<Record<SignUpFieldName, string>>

interface SignUpTextFieldConfig {
  id: string
  name: SignUpTextFieldName
  label: string
  type: 'email' | 'password' | 'text'
  placeholder: string
  autoComplete?: string
  required?: boolean
}

const INITIAL_SIGN_UP_FORM: SignUpFormState = {
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  otp: '',
}

const SIGN_UP_FIELDS: SignUpTextFieldConfig[] = [
  {
    id: 'signup-first-name',
    name: 'firstName',
    label: 'First name:',
    type: 'text',
    placeholder: 'Enter your first name',
    autoComplete: 'given-name',
    required: true,
  },
  {
    id: 'signup-middle-name',
    name: 'middleName',
    label: 'Middle name:',
    type: 'text',
    placeholder: 'Enter your middle name',
    autoComplete: 'additional-name',
    required: false,
  },
  {
    id: 'signup-last-name',
    name: 'lastName',
    label: 'Last name:',
    type: 'text',
    placeholder: 'Enter your last name',
    autoComplete: 'family-name',
    required: true,
  },
  {
    id: 'signup-email',
    name: 'email',
    label: 'Email address:',
    type: 'email',
    placeholder: 'admin@example.com',
    autoComplete: 'email',
    required: true,
  },
  {
    id: 'signup-password',
    name: 'password',
    label: 'Password:',
    type: 'password',
    placeholder: 'Enter your password',
    autoComplete: 'new-password',
    required: true,
  },
  {
    id: 'signup-confirm-password',
    name: 'confirmPassword',
    label: 'Confirm password:',
    type: 'password',
    placeholder: 'Re-enter your password',
    autoComplete: 'new-password',
    required: true,
  },
]

const NAME_FIELD_NAMES = new Set<SignUpTextFieldName>(['firstName', 'middleName', 'lastName'])

const toTitleCase = (value: string) =>
  value.replace(/\S+/g, (word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)

const SIGN_UP_COPY: Record<
  SignUpStep,
  {
    heading: string
    subheading: string
    submitLabel: string
  }
> = {
  details: {
    heading: 'Create Account for Admin',
    subheading: 'Enter your details first. We will send an OTP to verify your email.',
    submitLabel: 'Send OTP',
  },
  'verify-otp': {
    heading: 'Verify OTP',
    subheading: 'Enter the 6-digit OTP from your email to create your admin account.',
    submitLabel: 'Verify OTP & Create Account',
  },
  completed: {
    heading: 'Account Request Submitted',
    subheading:
      'Your admin account was created successfully. Go back to login and wait for account approval.',
    submitLabel: 'Back to Sign In',
  },
}

const normalizeSignUpForm = (formState: SignUpFormState) => ({
  firstName: toTitleCase(formState.firstName.trim()),
  middleName: toTitleCase(formState.middleName.trim()),
  lastName: toTitleCase(formState.lastName.trim()),
  email: formState.email.trim(),
})

function SignUpPage() {
  const navigate = useNavigate()
  const { clearToast, showToast, toast } = useToast()

  const [signUpStep, setSignUpStep] = useState<SignUpStep>('details')
  const [formState, setFormState] = useState<SignUpFormState>(INITIAL_SIGN_UP_FORM)
  const [fieldErrors, setFieldErrors] = useState<SignUpFieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [otpResendRemainingSeconds, setOtpResendRemainingSeconds] = useState(0)

  useEffect(() => {
    if (otpResendRemainingSeconds <= 0) {
      return
    }

    const timerId = window.setTimeout(() => {
      setOtpResendRemainingSeconds((currentSeconds) =>
        currentSeconds > 0 ? currentSeconds - 1 : 0,
      )
    }, 1000)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [otpResendRemainingSeconds])

  useEffect(() => {
    if (signUpStep !== 'verify-otp') {
      setOtpResendRemainingSeconds(0)
    }
  }, [signUpStep])

  const handleTextFieldChange = (name: SignUpTextFieldName, value: string) => {
    const normalizedValue = NAME_FIELD_NAMES.has(name) ? toTitleCase(value) : value

    setFormState((currentState) => ({
      ...currentState,
      [name]: normalizedValue,
    }))
    setFieldErrors((currentState) => {
      if (!currentState[name]) {
        return currentState
      }

      const nextState = { ...currentState }
      delete nextState[name]
      return nextState
    })
  }

  const handleOtpChange = (name: 'otp', value: string) => {
    setFormState((currentState) => ({
      ...currentState,
      [name]: value,
    }))
    setFieldErrors((currentState) => {
      if (!currentState[name]) {
        return currentState
      }

      const nextState = { ...currentState }
      delete nextState[name]
      return nextState
    })
  }

  const goToSignIn = () => {
    navigate(APP_ROUTES.login, { replace: true })
  }

  const sendSignUpOtp = async (email: string) => {
    const response = await authService.sendOtp({
      email,
      purpose: 'signup',
    })

    setOtpResendRemainingSeconds(getOtpResendCooldownSeconds(response))
    showToast(response?.message ?? 'OTP sent. Check your email inbox.', { variant: 'success' })
    setSignUpStep('verify-otp')
    setFieldErrors({})
  }

  const handleDetailsStep = async () => {
    const normalizedForm = normalizeSignUpForm(formState)
    const nextFieldErrors: SignUpFieldErrors = {}

    if (!normalizedForm.firstName) {
      nextFieldErrors.firstName = 'First name is required.'
    }

    if (!normalizedForm.lastName) {
      nextFieldErrors.lastName = 'Last name is required.'
    }

    if (!normalizedForm.email) {
      nextFieldErrors.email = 'Email address is required.'
    } else if (!isValidEmail(normalizedForm.email)) {
      nextFieldErrors.email = 'Please enter a valid email address.'
    }

    if (!formState.password) {
      nextFieldErrors.password = 'Password is required.'
    }

    if (!formState.confirmPassword) {
      nextFieldErrors.confirmPassword = 'Confirm password is required.'
    } else if (formState.password !== formState.confirmPassword) {
      nextFieldErrors.confirmPassword = 'Passwords do not match.'
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      return
    }

    setFieldErrors({})
    setFormState((currentState) => ({
      ...currentState,
      ...normalizedForm,
    }))

    await sendSignUpOtp(normalizedForm.email)
  }

  const handleVerifyOtpStep = async () => {
    const normalizedForm = normalizeSignUpForm(formState)
    const otp = formState.otp.trim()
    const nextFieldErrors: SignUpFieldErrors = {}

    if (!normalizedForm.email) {
      nextFieldErrors.email = 'Email address is required.'
    } else if (!isValidEmail(normalizedForm.email)) {
      nextFieldErrors.email = 'Email address must be a valid email.'
    }

    if (!/^\d{6}$/.test(otp)) {
      nextFieldErrors.otp = 'Please enter the 6-digit OTP code.'
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      return
    }

    setFieldErrors({})
    await authService.confirmOtp({
      email: normalizedForm.email,
      otp,
      purpose: 'signup',
    })

    const payload: SignUpPayload = {
      firstName: normalizedForm.firstName,
      middleName: normalizedForm.middleName,
      lastName: normalizedForm.lastName,
      email: normalizedForm.email,
      password: formState.password,
      role: 'ADMIN',
    }

    const response = await authService.signUp(payload)

    showToast(
      response?.message ??
        'Admin account created. Go back to sign in and wait for account approval.',
      { variant: 'success' },
    )
    setSignUpStep('completed')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearToast()

    if (signUpStep === 'completed') {
      goToSignIn()
      return
    }

    setIsSubmitting(true)

    try {
      if (signUpStep === 'details') {
        await handleDetailsStep()
        return
      }

      await handleVerifyOtpStep()
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResendOtp = async () => {
    const email = formState.email.trim()

    if (otpResendRemainingSeconds > 0) {
      showToast(
        `Please wait ${formatCountdownTime(otpResendRemainingSeconds)} before requesting again.`,
        { variant: 'info' },
      )
      return
    }

    if (!email) {
      setFieldErrors((currentState) => ({
        ...currentState,
        email: 'Email address is required to resend OTP.',
      }))
      return
    }

    if (!isValidEmail(email)) {
      setFieldErrors((currentState) => ({
        ...currentState,
        email: 'Email address must be a valid email.',
      }))
      return
    }

    clearToast()
    setIsSubmitting(true)

    try {
      await sendSignUpOtp(email)
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const signUpCopy = SIGN_UP_COPY[signUpStep]
  const isResendOtpDisabled = isSubmitting || otpResendRemainingSeconds > 0
  const resendOtpLabel =
    otpResendRemainingSeconds > 0
      ? `Resend OTP in ${formatCountdownTime(otpResendRemainingSeconds)}`
      : 'Resend OTP'
  const loadingSubtitle =
    signUpStep === 'details' ? 'Sending OTP...' : 'Verifying OTP and creating account...'

  return (
    <main className={styles.page}>
      <Toast toast={toast} onClose={clearToast} />
      <FullScreenLoader
        visible={isSubmitting}
        subtitle={loadingSubtitle}
        backgroundColor="rgba(0, 0, 0, 0.28)"
      />

      <section className={styles.card} aria-label="Create admin account">
        <img src={titleLogo} alt="Pawtner In Care" className={styles.logo} />

        <h1 className={styles.heading}>{signUpCopy.heading}</h1>
        <p className={styles.subheading}>{signUpCopy.subheading}</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.inputScrollArea}>
            {signUpStep === 'details'
              ? SIGN_UP_FIELDS.map((field) => (
                  <AuthTextField
                    key={field.id}
                    id={field.id}
                    name={field.name}
                    label={field.label}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={formState[field.name]}
                    autoComplete={field.autoComplete}
                    disabled={isSubmitting}
                    required={field.required ?? true}
                    errorMessage={fieldErrors[field.name]}
                    onValueChange={handleTextFieldChange}
                  />
                ))
              : null}

            {signUpStep === 'verify-otp' ? (
              <>
                <AuthTextField
                  id="signup-verify-email"
                  name="email"
                  label="Email address:"
                  type="email"
                  placeholder="admin@example.com"
                  value={formState.email}
                  autoComplete="email"
                  disabled
                  required
                  errorMessage={fieldErrors.email}
                  onValueChange={handleTextFieldChange}
                />
                <OtpCodeField
                  id="signup-otp"
                  name="otp"
                  label="OTP code:"
                  value={formState.otp}
                  onValueChange={handleOtpChange}
                  disabled={isSubmitting}
                  required
                  errorMessage={fieldErrors.otp}
                />
                <div className={styles.helperActionRow}>
                  <button
                    type="button"
                    className={styles.helperAction}
                    onClick={handleResendOtp}
                    disabled={isResendOtpDisabled}
                  >
                    {resendOtpLabel}
                  </button>
                </div>
              </>
            ) : null}
          </div>

          <button
            type="submit"
            className={signUpStep === 'completed' ? styles.backToSignInButton : styles.signUpButton}
            disabled={isSubmitting}
          >
            {signUpCopy.submitLabel}
          </button>

          {signUpStep !== 'completed' ? (
            <div className={`${styles.helperActionRow} ${styles.centerActionRow}`}>
              <button
                type="button"
                className={`${styles.backToSignInButton} ${styles.backInlineButton}`}
                onClick={goToSignIn}
                disabled={isSubmitting}
              >
                Back to Sign In
              </button>
            </div>
          ) : null}
        </form>
      </section>
    </main>
  )
}

export default SignUpPage
