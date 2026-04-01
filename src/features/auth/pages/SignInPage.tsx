import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import titleLogo from '@/assets/title-logo.png'
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
  getOtpResendCooldownSeconds,
  LOGIN_SUCCESS_DELAY_MS,
} from '@/features/auth/utils/auth-utils'
import { getErrorMessage } from '@/shared/api/api-error'
import Toast from '@/shared/components/feedback/Toast'
import FullScreenLoader from '@/shared/components/ui/FullScreenLoader/FullScreenLoader'
import { useToast } from '@/shared/hooks/useToast'
import { wait } from '@/shared/lib/async/wait'
import styles from './SignInPage.module.css'

interface SignInPageProps {
  onSignInSuccess?: (session: AuthSession) => void
}

function SignInPage({ onSignInSuccess }: SignInPageProps) {
  const [authView, setAuthView] = useState<AuthView>('sign-in')
  const { clearToast, showToast, toast } = useToast()

  const [formState, setFormState] = useState<SignInFormState>(INITIAL_SIGN_IN_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [forgotPasswordStep, setForgotPasswordStep] = useState<ForgotPasswordStep>('request-otp')
  const [forgotPasswordFormState, setForgotPasswordFormState] =
    useState<ForgotPasswordFormState>(INITIAL_FORGOT_PASSWORD_FORM)
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
  }

  const handleForgotPasswordFieldChange = (name: ForgotPasswordFieldName, value: string) => {
    setForgotPasswordFormState((currentState) => ({
      ...currentState,
      [name]: value,
    }))
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
  }

  const backToSignInView = () => {
    setAuthView('sign-in')
    setForgotPasswordStep('request-otp')
    setOtpResendRemainingSeconds(0)
    clearToast()

    if (forgotPasswordFormState.email.trim()) {
      setFormState((currentState) => ({
        ...currentState,
        email: forgotPasswordFormState.email.trim(),
      }))
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const payload: LoginPayload = {
      email: formState.email.trim(),
      password: formState.password,
    }

    if (!payload.email || !payload.password) {
      showToast('Please enter your email and password.', { variant: 'error' })
      return
    }

    clearToast()
    setIsSubmitting(true)

    try {
      const loginSession = await authService.login(payload)
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

    if (forgotPasswordStep === 'completed') {
      backToSignInView()
      return
    }

    setIsForgotPasswordSubmitting(true)

    try {
      if (forgotPasswordStep === 'request-otp') {
        if (!email) {
          showToast('Please enter your email address.', { variant: 'error' })
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
        if (!email) {
          showToast('Email address is required.', { variant: 'error' })
          return
        }

        if (!otp) {
          showToast('Please enter the OTP code.', { variant: 'error' })
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

      if (!email) {
        showToast('Email address is required.', { variant: 'error' })
        return
      }

      if (!forgotPasswordFormState.newPassword || !forgotPasswordFormState.confirmPassword) {
        showToast('Please enter and confirm your new password.', { variant: 'error' })
        return
      }

      if (forgotPasswordFormState.newPassword !== forgotPasswordFormState.confirmPassword) {
        showToast('Passwords do not match.', { variant: 'error' })
        return
      }

      const response = await authService.resetPassword({
        confirmPassword: forgotPasswordFormState.confirmPassword,
        email,
        newPassword: forgotPasswordFormState.newPassword,
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
      showToast('Email address is required to resend OTP.', { variant: 'error' })
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

            <form className={styles.form} onSubmit={handleSubmit}>
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
                  onActionClick={
                    field.name === 'password' ? openForgotPasswordView : undefined
                  }
                  onValueChange={handleTextFieldChange}
                />
              ))}

              <button type="submit" className={styles.signInButton} disabled={isSubmitting}>
                Sign In
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className={styles.heading}>{forgotPasswordCopy.heading}</h1>
            <p className={styles.subheading}>{forgotPasswordCopy.subheading}</p>

            <form className={styles.form} onSubmit={handleForgotPasswordSubmit}>
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
                className={styles.signInButton}
                disabled={isForgotPasswordSubmitting}
              >
                {forgotPasswordCopy.submitLabel}
              </button>

              {forgotPasswordStep !== 'completed' ? (
                <div className={styles.helperActionRow}>
                  <button
                    type="button"
                    className={styles.helperAction}
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
