import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import titleLogo from '@/assets/title-logo.png'
import { APP_ROUTES } from '@/app/routes/route-paths'
import { sessionPreloadService } from '@/app/services/session-preload.service'
import AuthTextField from '@/features/auth/components/AuthTextField'
import OtpCodeField from '@/features/auth/components/OtpCodeField'
import {
  FORGOT_PASSWORD_COPY,
  INITIAL_FORGOT_PASSWORD_FORM,
  INITIAL_SIGN_IN_FORM,
  REQUEST_OTP_FIELDS,
  RESET_PASSWORD_FIELDS,
  SIGN_IN_FIELDS,
  VERIFY_OTP_FIELDS,
} from '@/features/auth/constants/auth-form.config'
import { authService } from '@/features/auth/services/auth.service'
import type { AuthSession, LoginPayload } from '@/features/auth/types/auth-api'
import type {
  AuthView,
  ForgotPasswordFieldName,
  ForgotPasswordFormState,
  ForgotPasswordStep,
  SignInFormState,
  SignInTextFieldName,
} from '@/features/auth/types/auth'
import {
  formatCountdownTime,
  isAdminAuthSession,
  getOtpResendCooldownSeconds,
  LOGIN_SUCCESS_DELAY_MS,
} from '@/features/auth/utils/auth-utils'
import { getErrorMessage } from '@/shared/api/api-error'
import Toast from '@/shared/components/feedback/Toast'
import FullScreenLoader from '@/shared/components/ui/FullScreenLoader/FullScreenLoader'
import { useToast } from '@/shared/hooks/useToast'
import { wait } from '@/shared/lib/async/wait'
import { isValidEmail } from '@/shared/lib/validation/contact'
import styles from './SignInPage.module.css'

interface SignInPageProps {
  onSignInSuccess?: (session: AuthSession) => void
}

type SignInFieldErrors = Partial<Record<SignInTextFieldName, string>>
type ForgotPasswordFieldErrors = Partial<Record<ForgotPasswordFieldName, string>>

function SignInPage({ onSignInSuccess }: SignInPageProps) {
  const navigate = useNavigate()
  const [authView, setAuthView] = useState<AuthView>('sign-in')
  const { clearToast, showToast, toast } = useToast()

  const [formState, setFormState] = useState<SignInFormState>(INITIAL_SIGN_IN_FORM)
  const [signInFieldErrors, setSignInFieldErrors] = useState<SignInFieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [forgotPasswordStep, setForgotPasswordStep] = useState<ForgotPasswordStep>('request-otp')
  const [forgotPasswordFormState, setForgotPasswordFormState] =
    useState<ForgotPasswordFormState>(INITIAL_FORGOT_PASSWORD_FORM)
  const [forgotPasswordFieldErrors, setForgotPasswordFieldErrors] =
    useState<ForgotPasswordFieldErrors>({})
  const [isForgotPasswordSubmitting, setIsForgotPasswordSubmitting] = useState(false)
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
    if (forgotPasswordStep !== 'verify-otp') {
      setOtpResendRemainingSeconds(0)
    }
  }, [forgotPasswordStep])

  const handleTextFieldChange = (name: SignInTextFieldName, value: string) => {
    setFormState((currentState) => ({
      ...currentState,
      [name]: value,
    }))
    setSignInFieldErrors((currentState) => {
      if (!currentState[name]) {
        return currentState
      }

      const nextState = { ...currentState }
      delete nextState[name]
      return nextState
    })
  }

  const handleForgotPasswordFieldChange = (name: ForgotPasswordFieldName, value: string) => {
    setForgotPasswordFormState((currentState) => ({
      ...currentState,
      [name]: value,
    }))
    setForgotPasswordFieldErrors((currentState) => {
      if (!currentState[name]) {
        return currentState
      }

      const nextState = { ...currentState }
      delete nextState[name]
      return nextState
    })
  }

  const openForgotPasswordView = () => {
    setAuthView('forgot-password')
    setForgotPasswordStep('request-otp')
    setOtpResendRemainingSeconds(0)
    clearToast()
    setForgotPasswordFormState({
      ...INITIAL_FORGOT_PASSWORD_FORM,
      email: formState.email.trim(),
    })
    setForgotPasswordFieldErrors({})
  }

  const backToSignInView = () => {
    setAuthView('sign-in')
    setForgotPasswordStep('request-otp')
    setOtpResendRemainingSeconds(0)
    clearToast()
    setSignInFieldErrors({})
    setForgotPasswordFieldErrors({})

    if (forgotPasswordFormState.email.trim()) {
      setFormState((currentState) => ({
        ...currentState,
        email: forgotPasswordFormState.email.trim(),
      }))
    }
  }

  const openSignUpView = () => {
    clearToast()
    navigate(APP_ROUTES.signUp)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const payload: LoginPayload = {
      email: formState.email.trim(),
      password: formState.password,
    }

    const nextFieldErrors: SignInFieldErrors = {}

    if (!payload.email) {
      nextFieldErrors.email = 'Email address is required.'
    } else if (!isValidEmail(payload.email)) {
      nextFieldErrors.email = 'Please enter a valid email address.'
    }

    if (!payload.password) {
      nextFieldErrors.password = 'Password is required.'
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setSignInFieldErrors(nextFieldErrors)
      return
    }

    setSignInFieldErrors({})
    clearToast()
    setIsSubmitting(true)

    try {
      const loginSession = await authService.login(payload)

      if (!isAdminAuthSession(loginSession)) {
        showToast('Only admin accounts can log in to the web dashboard.', { variant: 'error' })
        return
      }

      const hydratedSession = await sessionPreloadService.preloadSessionData(loginSession)
      await wait(LOGIN_SUCCESS_DELAY_MS)
      onSignInSuccess?.(hydratedSession)
      showToast('Sign in successful.', { variant: 'success' })
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const sendForgotPasswordOtp = async (email: string) => {
    const response = await authService.sendOtp({
      email,
      purpose: 'reset-password',
    })

    setOtpResendRemainingSeconds(getOtpResendCooldownSeconds(response))
    showToast(response?.message ?? 'OTP sent. Check your email inbox.', { variant: 'success' })
    setForgotPasswordStep('verify-otp')
  }

  const handleForgotPasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const email = forgotPasswordFormState.email.trim()
    const otp = forgotPasswordFormState.otp.trim()

    clearToast()
    setForgotPasswordFieldErrors({})

    if (forgotPasswordStep === 'completed') {
      backToSignInView()
      return
    }

    setIsForgotPasswordSubmitting(true)

    try {
      if (forgotPasswordStep === 'request-otp') {
        const nextFieldErrors: ForgotPasswordFieldErrors = {}

        if (!email) {
          nextFieldErrors.email = 'Email address is required.'
        } else if (!isValidEmail(email)) {
          nextFieldErrors.email = 'Please enter a valid email address.'
        }

        if (Object.keys(nextFieldErrors).length > 0) {
          setForgotPasswordFieldErrors(nextFieldErrors)
          return
        }

        setForgotPasswordFormState((currentState) => ({
          ...currentState,
          email,
        }))

        await sendForgotPasswordOtp(email)
        return
      }

      if (forgotPasswordStep === 'verify-otp') {
        const nextFieldErrors: ForgotPasswordFieldErrors = {}

        if (!email) {
          nextFieldErrors.email = 'Email address is required.'
        } else if (!isValidEmail(email)) {
          nextFieldErrors.email = 'Email address must be a valid email.'
        }

        if (!otp) {
          nextFieldErrors.otp = 'Please enter the OTP code.'
        } else if (!/^\d{6}$/.test(otp)) {
          nextFieldErrors.otp = 'Please enter a valid 6-digit OTP code.'
        }

        if (Object.keys(nextFieldErrors).length > 0) {
          setForgotPasswordFieldErrors(nextFieldErrors)
          return
        }

        await authService.confirmOtp({
          email,
          otp,
          purpose: 'reset-password',
        })

        showToast('OTP verified. You can now set a new password.', { variant: 'success' })
        setForgotPasswordStep('reset-password')
        return
      }

      const nextFieldErrors: ForgotPasswordFieldErrors = {}

      if (!email) {
        nextFieldErrors.email = 'Email address is required.'
      } else if (!isValidEmail(email)) {
        nextFieldErrors.email = 'Email address must be a valid email.'
      }

      if (!forgotPasswordFormState.newPassword) {
        nextFieldErrors.newPassword = 'New password is required.'
      }

      if (!forgotPasswordFormState.confirmPassword) {
        nextFieldErrors.confirmPassword = 'Confirm password is required.'
      } else if (forgotPasswordFormState.newPassword !== forgotPasswordFormState.confirmPassword) {
        nextFieldErrors.confirmPassword = 'Passwords do not match.'
      }

      if (!/^\d{6}$/.test(otp)) {
        nextFieldErrors.otp = 'Please verify your 6-digit OTP again.'
      }

      if (Object.keys(nextFieldErrors).length > 0) {
        if (nextFieldErrors.otp) {
          setForgotPasswordStep('verify-otp')
        }
        setForgotPasswordFieldErrors(nextFieldErrors)
        return
      }

      const response = await authService.resetPassword({
        confirmPassword: forgotPasswordFormState.confirmPassword,
        email,
        newPassword: forgotPasswordFormState.newPassword,
        otp,
      })

      showToast(response?.message ?? 'Your password has been reset.', { variant: 'success' })
      setForgotPasswordStep('completed')
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsForgotPasswordSubmitting(false)
    }
  }

  const handleResendOtp = async () => {
    const email = forgotPasswordFormState.email.trim()

    if (otpResendRemainingSeconds > 0) {
      showToast(
        `Please wait ${formatCountdownTime(otpResendRemainingSeconds)} before requesting again.`,
        { variant: 'info' },
      )
      return
    }

    if (!email) {
      setForgotPasswordFieldErrors((currentState) => ({
        ...currentState,
        email: 'Email address is required to resend OTP.',
      }))
      return
    }

    if (!isValidEmail(email)) {
      setForgotPasswordFieldErrors((currentState) => ({
        ...currentState,
        email: 'Email address must be a valid email.',
      }))
      return
    }

    clearToast()
    setIsForgotPasswordSubmitting(true)

    try {
      await sendForgotPasswordOtp(email)
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsForgotPasswordSubmitting(false)
    }
  }

  const forgotPasswordCopy = FORGOT_PASSWORD_COPY[forgotPasswordStep]
  const isResendOtpDisabled = isForgotPasswordSubmitting || otpResendRemainingSeconds > 0
  const resendOtpLabel =
    otpResendRemainingSeconds > 0
      ? `Resend OTP in ${formatCountdownTime(otpResendRemainingSeconds)}`
      : 'Resend OTP'
  const forgotPasswordFields =
    forgotPasswordStep === 'request-otp'
      ? REQUEST_OTP_FIELDS
      : forgotPasswordStep === 'verify-otp'
        ? VERIFY_OTP_FIELDS
        : forgotPasswordStep === 'reset-password'
          ? RESET_PASSWORD_FIELDS
          : []

  return (
    <main className={styles.page}>
      <Toast toast={toast} onClose={clearToast} />
      <FullScreenLoader
        visible={isSubmitting}
        subtitle="Signing you in..."
        backgroundColor="rgba(0, 0, 0, 0.28)"
      />

      <section className={styles.card} aria-label="Sign in">
        <img src={titleLogo} alt="Pawtner In Care" className={styles.logo} />

        {authView === 'sign-in' ? (
          <>
            <h1 className={styles.heading}>Login to Dashboard</h1>
            <p className={styles.subheading}>
              Please enter your email and password to continue
            </p>

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              {SIGN_IN_FIELDS.map((field) => (
                <AuthTextField
                  key={field.id}
                  id={field.id}
                  name={field.name}
                  label={field.label}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={formState[field.name]}
                  actionText={field.actionText}
                  actionPlacement={field.actionPlacement}
                  errorMessage={signInFieldErrors[field.name]}
                  onActionClick={
                    field.name === 'password' ? openForgotPasswordView : undefined
                  }
                  onValueChange={handleTextFieldChange}
                />
              ))}

              <button type="submit" className={styles.signInButton} disabled={isSubmitting}>
                Sign In
              </button>

              <div className={styles.createAccountRow}>
                <span className={styles.createAccountLabel}>Don&apos;t have an account?</span>
                <button
                  type="button"
                  className={styles.createAccountAction}
                  onClick={openSignUpView}
                  disabled={isSubmitting}
                >
                  Create Account
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h1 className={styles.heading}>{forgotPasswordCopy.heading}</h1>
            <p className={styles.subheading}>{forgotPasswordCopy.subheading}</p>

            <form className={styles.form} onSubmit={handleForgotPasswordSubmit} noValidate>
              {forgotPasswordFields.map((field) =>
                field.name === 'otp' ? (
                  <OtpCodeField
                    key={field.id}
                    id={field.id}
                    name={field.name}
                    label={field.label}
                    value={forgotPasswordFormState[field.name]}
                    onValueChange={handleForgotPasswordFieldChange}
                    disabled={isForgotPasswordSubmitting}
                    errorMessage={forgotPasswordFieldErrors[field.name]}
                  />
                ) : (
                  <AuthTextField
                    key={field.id}
                    id={field.id}
                    name={field.name}
                    label={field.label}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={forgotPasswordFormState[field.name]}
                    errorMessage={forgotPasswordFieldErrors[field.name]}
                    onValueChange={handleForgotPasswordFieldChange}
                  />
                ),
              )}

              {forgotPasswordStep === 'verify-otp' ? (
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
              ) : null}

              <button
                type="submit"
                className={
                  forgotPasswordStep === 'completed' ? styles.backToSignInButton : styles.signInButton
                }
                disabled={isForgotPasswordSubmitting}
              >
                {forgotPasswordCopy.submitLabel}
              </button>

              {forgotPasswordStep !== 'completed' ? (
                <div className={`${styles.helperActionRow} ${styles.centerActionRow}`}>
                  <button
                    type="button"
                    className={`${styles.backToSignInButton} ${styles.backInlineButton}`}
                    onClick={backToSignInView}
                    disabled={isForgotPasswordSubmitting}
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : null}
            </form>
          </>
        )}
      </section>
    </main>
  )
}

export default SignInPage
