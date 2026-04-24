import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { FaEdit, FaSave, FaUserCircle } from 'react-icons/fa'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { authService } from '@/features/auth/services/auth.service'
import { authStorage } from '@/features/auth/services/auth.storage'
import { formatCountdownTime, getAuthSessionUserId, getOtpResendCooldownSeconds } from '@/features/auth/utils/auth-utils'
import { userService } from '@/features/users/services/user.service'
import { defaultHeaderProfile, sidebarBottomItems, sidebarLogo, sidebarMenuItems } from '@/layouts/config/navigation'
import Header from '@/layouts/Header/Header'
import MainLayout from '@/layouts/MainLayout/MainLayout'
import Sidebar from '@/layouts/Sidebar/Sidebar'
import { ApiError, getErrorMessage } from '@/shared/api/api-error'
import Toast from '@/shared/components/feedback/Toast'
import PhotoUploadField from '@/shared/components/media/PhotoUploadField/PhotoUploadField'
import { useHeaderProfile } from '@/shared/hooks/useHeaderProfile'
import { useResponsiveSidebar } from '@/shared/hooks/useResponsiveSidebar'
import { useToast } from '@/shared/hooks/useToast'
import { getStringField } from '@/shared/lib/profile/header-profile'
import { getPasswordValidationError } from '@/shared/lib/validation/password'
import { userStorage } from '@/shared/services/user.storage'
import type { SidebarItemKey } from '@/shared/types/layout'
import styles from './ProfileSettingsPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'profile-settings'
const OTP_LENGTH = 6
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type ChangePasswordStep = 'request' | 'otp' | 'password'

type ProfileFormErrors = {
  email?: string
  firstName?: string
  lastName?: string
}

type PasswordFormErrors = {
  confirmPassword?: string
  email?: string
  newPassword?: string
  otp?: string
}

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const resolveRoleToken = (user: AuthSession['user']) => {
  const resolvedRole =
    getStringField(user, ['role', 'userRole', 'userType']) ||
    (user && typeof user === 'object' ? getStringField((user as Record<string, unknown>).role, ['name', 'label', 'title']) : '')

  const normalizedRole = resolvedRole.toUpperCase()
  return normalizedRole === 'ADMIN' || normalizedRole === 'SYSTEM_ADMIN' ? 'ADMIN' : 'USER'
}

const mapUnknownUserToForm = (value: unknown) => ({
  email: getStringField(value, ['email']),
  firstName: getStringField(value, ['firstName', 'firstname']),
  lastName: getStringField(value, ['lastName', 'lastname']),
  middleName: getStringField(value, ['middleName', 'middlename']),
  profilePicture: getStringField(value, ['profilePicture', 'avatar', 'avatarUrl', 'profileImage', 'photoUrl']),
})

interface ProfileSettingsPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

function ProfileSettingsPage({ onLogout, session }: ProfileSettingsPageProps) {
  const { clearToast, showToast, toast } = useToast()
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const [searchValue, setSearchValue] = useState('')
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isProfileEditMode, setIsProfileEditMode] = useState(false)
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false)
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0)
  const [changePasswordStep, setChangePasswordStep] = useState<ChangePasswordStep>('request')
  const [profileFormErrors, setProfileFormErrors] = useState<ProfileFormErrors>({})
  const [passwordFormErrors, setPasswordFormErrors] = useState<PasswordFormErrors>({})
  const [passwordApiError, setPasswordApiError] = useState('')

  const accessToken = normalizeText(session?.accessToken)
  const userId = getAuthSessionUserId(session?.user)
  const resolvedHeaderProfile = useHeaderProfile({ fallbackProfile: defaultHeaderProfile, session })
  const resolvedUserForm = useMemo(() => mapUnknownUserToForm(session?.user), [session?.user])

  const [firstName, setFirstName] = useState(resolvedUserForm.firstName)
  const [middleName, setMiddleName] = useState(resolvedUserForm.middleName)
  const [lastName, setLastName] = useState(resolvedUserForm.lastName)
  const [email, setEmail] = useState(resolvedUserForm.email)
  const [profilePicture, setProfilePicture] = useState(resolvedUserForm.profilePicture)
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false)
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false)
  const [profileSnapshot, setProfileSnapshot] = useState(resolvedUserForm)
  useEffect(() => {
    setFirstName(resolvedUserForm.firstName)
    setMiddleName(resolvedUserForm.middleName)
    setLastName(resolvedUserForm.lastName)
    setEmail(resolvedUserForm.email)
    setProfilePicture(resolvedUserForm.profilePicture)
    setProfileSnapshot(resolvedUserForm)
    setIsProfileEditMode(false)
  }, [resolvedUserForm])

  useEffect(() => {
    if (!resendSecondsLeft) {
      return
    }

    const timeout = window.setTimeout(() => {
      setResendSecondsLeft((value) => Math.max(0, value - 1))
    }, 1000)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [resendSecondsLeft])

  useEffect(() => {
    if (!accessToken || !userId) {
      return
    }

    let isMounted = true
    setIsLoadingProfile(true)

    const loadProfile = async () => {
      try {
        const user = await userService.getOne(userId, accessToken)

        if (!isMounted) {
          return
        }

        setFirstName(normalizeText(user.firstName))
        setMiddleName(normalizeText(user.middleName))
        setLastName(normalizeText(user.lastName))
        setEmail(normalizeText(user.email))
        setProfilePicture(normalizeText(user.profilePicture))
        setProfileSnapshot({
          email: normalizeText(user.email),
          firstName: normalizeText(user.firstName),
          lastName: normalizeText(user.lastName),
          middleName: normalizeText(user.middleName),
          profilePicture: normalizeText(user.profilePicture),
        })
      } catch (error) {
        if (isMounted) {
          showToast(getErrorMessage(error, 'Unable to load your latest profile details.'), { variant: 'error' })
        }
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false)
        }
      }
    }

    void loadProfile()

    return () => {
      isMounted = false
    }
  }, [accessToken, showToast, userId])

  const clearPasswordErrors = () => {
    setPasswordFormErrors({})
    setPasswordApiError('')
  }

  const persistSessionProfile = (nextUserRecord: Record<string, unknown>) => {
    const sessionSnapshot = session

    if (!sessionSnapshot) {
      return
    }

    const nextSession: AuthSession = {
      ...sessionSnapshot,
      user: nextUserRecord,
    }

    authStorage.setSession(nextSession)

    if (typeof nextUserRecord.id === 'string' && nextUserRecord.id) {
      userStorage.setUserProfile({
        id: nextUserRecord.id,
        ...nextUserRecord,
      })
    }
  }

  const handleProfileSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!isProfileEditMode) {
      return
    }

    if (!accessToken || !userId) {
      showToast('Your session has expired. Please sign in again.', { variant: 'error' })
      return
    }

    const trimmedFirstName = firstName.trim()
    const trimmedMiddleName = middleName.trim()
    const trimmedLastName = lastName.trim()
    const trimmedEmail = email.trim()
    const trimmedProfilePicture = profilePicture.trim()
    const nextErrors: ProfileFormErrors = {}

    if (!trimmedFirstName) {
      nextErrors.firstName = 'First name is required.'
    }

    if (!trimmedLastName) {
      nextErrors.lastName = 'Last name is required.'
    }

    if (!trimmedEmail) {
      nextErrors.email = 'Email is required.'
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      nextErrors.email = 'Enter a valid email address.'
    }

    setProfileFormErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsSavingProfile(true)

    try {
      const updatedUser = await userService.update(
        userId,
        {
          email: trimmedEmail,
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          middleName: trimmedMiddleName || null,
          profilePicture: trimmedProfilePicture || null,
          role: resolveRoleToken(session?.user),
        },
        accessToken,
      )

      const nextUserRecord = {
        ...(session?.user && typeof session.user === 'object' ? session.user : {}),
        ...updatedUser,
        id: userId,
      }

      persistSessionProfile(nextUserRecord)
      setFirstName(normalizeText(updatedUser.firstName) || trimmedFirstName)
      setMiddleName(normalizeText(updatedUser.middleName) || trimmedMiddleName)
      setLastName(normalizeText(updatedUser.lastName) || trimmedLastName)
      setEmail(normalizeText(updatedUser.email) || trimmedEmail)
      setProfilePicture(normalizeText(updatedUser.profilePicture) || trimmedProfilePicture)
      setProfileSnapshot({
        email: normalizeText(updatedUser.email) || trimmedEmail,
        firstName: normalizeText(updatedUser.firstName) || trimmedFirstName,
        lastName: normalizeText(updatedUser.lastName) || trimmedLastName,
        middleName: normalizeText(updatedUser.middleName) || trimmedMiddleName,
        profilePicture: normalizeText(updatedUser.profilePicture) || trimmedProfilePicture,
      })
      setProfileFormErrors({})
      setIsProfileEditMode(false)
      showToast('Profile updated successfully.', { variant: 'success' })
    } catch (error) {
      showToast(getErrorMessage(error, 'Unable to update your profile right now.'), { variant: 'error' })
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleSendOtp = async () => {
    const normalizedEmail = email.trim()
    clearPasswordErrors()

    if (!normalizedEmail) {
      setPasswordFormErrors({ email: 'Email is required to request OTP.' })
      return
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setPasswordFormErrors({ email: 'Enter a valid email address to request OTP.' })
      return
    }

    setIsSubmittingPassword(true)

    try {
      const response = await authService.sendOtp({
        email: normalizedEmail,
        purpose: 'reset-password',
      })
      setResendSecondsLeft(getOtpResendCooldownSeconds(response))
      setChangePasswordStep('otp')
      showToast(response?.message ?? 'Password reset OTP sent.', { variant: 'success' })
    } catch (error) {
      setPasswordApiError(getErrorMessage(error, 'Unable to send OTP right now.'))
    } finally {
      setIsSubmittingPassword(false)
    }
  }

  const handleConfirmOtp = async () => {
    const normalizedEmail = email.trim()
    const normalizedOtp = otpCode.trim()
    clearPasswordErrors()

    if (!normalizedEmail) {
      setPasswordFormErrors({ email: 'Email is required.' })
      return
    }

    if (normalizedOtp.length < OTP_LENGTH) {
      setPasswordFormErrors({ otp: 'OTP is required.' })
      return
    }

    setIsSubmittingPassword(true)

    try {
      await authService.confirmOtp({
        email: normalizedEmail,
        otp: normalizedOtp,
        purpose: 'reset-password',
      })
      setChangePasswordStep('password')
      showToast('OTP verified. Set your new password.', { variant: 'success' })
    } catch (error) {
      setPasswordApiError(getErrorMessage(error, 'Unable to verify OTP right now.'))
    } finally {
      setIsSubmittingPassword(false)
    }
  }

  const handleSavePassword = async () => {
    const normalizedEmail = email.trim()
    const normalizedOtp = otpCode.trim()
    const nextErrors: PasswordFormErrors = {}
    const passwordError = getPasswordValidationError(newPassword)

    clearPasswordErrors()

    if (!passwordError && !newPassword.trim()) {
      nextErrors.newPassword = 'New password is required.'
    } else if (passwordError) {
      nextErrors.newPassword = passwordError
    }

    if (!confirmPassword.trim()) {
      nextErrors.confirmPassword = 'Confirm password is required.'
    } else if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.'
    }

    if (normalizedOtp.length < OTP_LENGTH) {
      nextErrors.otp = 'OTP is required.'
    }

    if (!normalizedEmail) {
      nextErrors.email = 'Email is required.'
    }

    setPasswordFormErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsSubmittingPassword(true)

    try {
      await authService.resetPassword({
        confirmPassword,
        email: normalizedEmail,
        newPassword,
        otp: normalizedOtp,
      })
      setNewPassword('')
      setConfirmPassword('')
      setOtpCode('')
      setResendSecondsLeft(0)
      setChangePasswordStep('request')
      showToast('Password updated successfully.', { variant: 'success' })
    } catch (error) {
      setPasswordApiError(getErrorMessage(error, 'Unable to reset password right now.'))
    } finally {
      setIsSubmittingPassword(false)
    }
  }

  const handleChangePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (changePasswordStep === 'request') {
      await handleSendOtp()
      return
    }

    if (changePasswordStep === 'otp') {
      await handleConfirmOtp()
      return
    }

    await handleSavePassword()
  }

  const handleResendOtp = async () => {
    if (isSubmittingPassword || resendSecondsLeft > 0) {
      return
    }

    await handleSendOtp()
  }

  const handlePasswordSecondaryAction = () => {
    clearPasswordErrors()

    if (changePasswordStep === 'password') {
      setChangePasswordStep('otp')
      setNewPassword('')
      setConfirmPassword('')
      return
    }

    if (changePasswordStep === 'otp') {
      setChangePasswordStep('request')
      setOtpCode('')
      setResendSecondsLeft(0)
    }
  }

  const handleProfileCancel = () => {
    setFirstName(profileSnapshot.firstName)
    setMiddleName(profileSnapshot.middleName)
    setLastName(profileSnapshot.lastName)
    setEmail(profileSnapshot.email)
    setProfilePicture(profileSnapshot.profilePicture)
    setProfileFormErrors({})
    setIsProfileEditMode(false)
  }

  const submitPasswordLabel =
    changePasswordStep === 'request'
      ? 'Send OTP'
      : changePasswordStep === 'otp'
        ? 'Confirm OTP'
        : 'Save New Password'

  return (
    <MainLayout
      isSidebarOpen={isSidebarOpen}
      onSidebarClose={() => {
        setIsSidebarOpen(false)
      }}
      header={
        <Header
          profile={resolvedHeaderProfile}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          isMenuOpen={isSidebarOpen}
          onMenuToggle={() => {
            setIsSidebarOpen((previousState) => !previousState)
          }}
        />
      }
      sidebar={
        <Sidebar
          activeItem={ACTIVE_MENU_ITEM}
          logoSrc={sidebarLogo}
          menuItems={sidebarMenuItems}
          bottomItems={sidebarBottomItems}
          onLogout={onLogout}
        />
      }
    >
      <Toast toast={toast} onClose={clearToast} />

      <div className={styles.page}>
        <section className={styles.container}>
          <header className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>Profile Settings</h1>
          </header>

          {!userId || !accessToken ? (
            <section className={styles.formPanel}>
              <p className={styles.fieldError}>Your session is missing profile permissions. Please sign in again.</p>
            </section>
          ) : (
            <div className={styles.panelGrid}>
              <form className={styles.formPanel} onSubmit={handleProfileSave} noValidate>
                <h2 className={styles.sectionTitle}>Profile</h2>

                {!isProfileEditMode ? (
                  <div className={styles.profileIdentity}>
                    <div className={styles.profileIdentityAvatar}>
                      {profilePicture.trim() ? (
                        <img src={profilePicture.trim()} alt="Profile photo" className={styles.profileIdentityAvatarImage} />
                      ) : (
                        <FaUserCircle className={styles.profileIdentityAvatarIcon} aria-hidden="true" />
                      )}
                    </div>
                  </div>
                ) : null}

                <label className={styles.fieldLabel}>
                  <span>First Name</span>
                  {isProfileEditMode ? (
                    <input
                      type="text"
                      className={`${styles.fieldInput} ${profileFormErrors.firstName ? styles.fieldInputError : ''}`}
                      value={firstName}
                      onChange={(event) => {
                        setFirstName(event.target.value)
                        setProfileFormErrors((errors) => ({ ...errors, firstName: undefined }))
                      }}
                      placeholder="Enter first name"
                      disabled={isSavingProfile || isLoadingProfile}
                      aria-invalid={Boolean(profileFormErrors.firstName)}
                    />
                  ) : (
                    <span className={styles.detailValue}>{firstName.trim() || 'N/A'}</span>
                  )}
                  {profileFormErrors.firstName ? <p className={styles.fieldError}>{profileFormErrors.firstName}</p> : null}
                </label>

                <label className={styles.fieldLabel}>
                  <span>Middle Name</span>
                  {isProfileEditMode ? (
                    <input
                      type="text"
                      className={styles.fieldInput}
                      value={middleName}
                      onChange={(event) => {
                        setMiddleName(event.target.value)
                      }}
                      placeholder="Enter middle name"
                      disabled={isSavingProfile || isLoadingProfile}
                    />
                  ) : (
                    <span className={styles.detailValue}>{middleName.trim() || 'N/A'}</span>
                  )}
                </label>

                <label className={styles.fieldLabel}>
                  <span>Last Name</span>
                  {isProfileEditMode ? (
                    <input
                      type="text"
                      className={`${styles.fieldInput} ${profileFormErrors.lastName ? styles.fieldInputError : ''}`}
                      value={lastName}
                      onChange={(event) => {
                        setLastName(event.target.value)
                        setProfileFormErrors((errors) => ({ ...errors, lastName: undefined }))
                      }}
                      placeholder="Enter last name"
                      disabled={isSavingProfile || isLoadingProfile}
                      aria-invalid={Boolean(profileFormErrors.lastName)}
                    />
                  ) : (
                    <span className={styles.detailValue}>{lastName.trim() || 'N/A'}</span>
                  )}
                  {profileFormErrors.lastName ? <p className={styles.fieldError}>{profileFormErrors.lastName}</p> : null}
                </label>

                <label className={styles.fieldLabel}>
                  <span>Email Address</span>
                  {isProfileEditMode ? (
                    <input
                      type="email"
                      className={`${styles.fieldInput} ${profileFormErrors.email ? styles.fieldInputError : ''}`}
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value)
                        setProfileFormErrors((errors) => ({ ...errors, email: undefined }))
                      }}
                      placeholder="hello@pawtnercare.com"
                      disabled={isSavingProfile || isLoadingProfile}
                      aria-invalid={Boolean(profileFormErrors.email)}
                    />
                  ) : (
                    <span className={styles.detailValue}>{email.trim() || 'N/A'}</span>
                  )}
                  {profileFormErrors.email ? <p className={styles.fieldError}>{profileFormErrors.email}</p> : null}
                </label>

                {isProfileEditMode ? (
                  <label className={styles.fieldLabel}>
                    <span>Profile Photo</span>
                    <PhotoUploadField
                      title="Profile Photo"
                      subtitle="Upload a profile photo."
                      choosePhotoButtonLabel="Choose Profile Photo"
                      cameraButtonLabel="Open Camera"
                      cropAspectRatio={1}
                      value={profilePicture}
                      onChange={(nextPhoto) => {
                        setProfilePicture(nextPhoto)
                      }}
                      onNotify={(message, variant) => {
                        showToast(message, { variant })
                      }}
                      disabled={isSavingProfile || isLoadingProfile}
                    />
                  </label>
                ) : null}

                <div className={styles.footerActions}>
                  {isProfileEditMode ? (
                    <>
                      <button
                        type="button"
                        className={styles.resetButton}
                        onClick={handleProfileCancel}
                        disabled={isSavingProfile || isLoadingProfile}
                      >
                        Cancel
                      </button>
                      <button type="submit" className={styles.saveButton} disabled={isSavingProfile || isLoadingProfile}>
                        <FaSave aria-hidden="true" />
                        {isSavingProfile ? 'Saving...' : 'Save Profile'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={styles.saveButton}
                      onClick={() => {
                        setIsProfileEditMode(true)
                        setProfileFormErrors({})
                      }}
                      disabled={isLoadingProfile}
                    >
                      <FaEdit aria-hidden="true" />
                      Edit Profile
                    </button>
                  )}
                </div>
              </form>

              <form className={styles.formPanel} onSubmit={handleChangePasswordSubmit} noValidate>
                <h2 className={styles.sectionTitle}>Change Password</h2>
                <p className={styles.caption}>We use your current profile email for OTP verification.</p>

                <label className={styles.fieldLabel}>
                  <span>Email</span>
                  <span className={styles.detailValue}>{email.trim() || 'No email set'}</span>
                  {passwordFormErrors.email ? <p className={styles.fieldError}>{passwordFormErrors.email}</p> : null}
                </label>

                {changePasswordStep === 'otp' || changePasswordStep === 'password' ? (
                  <label className={styles.fieldLabel}>
                    <span>OTP Code</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={OTP_LENGTH}
                      className={`${styles.fieldInput} ${passwordFormErrors.otp ? styles.fieldInputError : ''}`}
                      value={otpCode}
                      onChange={(event) => {
                        setOtpCode(event.target.value.replace(/\D/g, ''))
                        setPasswordFormErrors((errors) => ({ ...errors, otp: undefined }))
                      }}
                      placeholder="Enter 6-digit OTP"
                      disabled={isSubmittingPassword}
                    />
                    {passwordFormErrors.otp ? <p className={styles.fieldError}>{passwordFormErrors.otp}</p> : null}
                  </label>
                ) : null}

                {changePasswordStep === 'password' ? (
                  <>
                    <label className={styles.fieldLabel}>
                      <span>New Password</span>
                      <div className={styles.passwordInputWrap}>
                        <input
                          type={isNewPasswordVisible ? 'text' : 'password'}
                          className={`${styles.fieldInput} ${passwordFormErrors.newPassword ? styles.fieldInputError : ''}`}
                          value={newPassword}
                          onChange={(event) => {
                            setNewPassword(event.target.value)
                            setPasswordFormErrors((errors) => ({ ...errors, newPassword: undefined }))
                          }}
                          placeholder="Enter new password"
                          disabled={isSubmittingPassword}
                        />
                        <button
                          type="button"
                          className={styles.passwordToggle}
                          onClick={() => {
                            setIsNewPasswordVisible((value) => !value)
                          }}
                        >
                          {isNewPasswordVisible ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      {passwordFormErrors.newPassword ? <p className={styles.fieldError}>{passwordFormErrors.newPassword}</p> : null}
                    </label>

                    <label className={styles.fieldLabel}>
                      <span>Confirm Password</span>
                      <div className={styles.passwordInputWrap}>
                        <input
                          type={isConfirmPasswordVisible ? 'text' : 'password'}
                          className={`${styles.fieldInput} ${passwordFormErrors.confirmPassword ? styles.fieldInputError : ''}`}
                          value={confirmPassword}
                          onChange={(event) => {
                            setConfirmPassword(event.target.value)
                            setPasswordFormErrors((errors) => ({ ...errors, confirmPassword: undefined }))
                          }}
                          placeholder="Confirm new password"
                          disabled={isSubmittingPassword}
                        />
                        <button
                          type="button"
                          className={styles.passwordToggle}
                          onClick={() => {
                            setIsConfirmPasswordVisible((value) => !value)
                          }}
                        >
                          {isConfirmPasswordVisible ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      {passwordFormErrors.confirmPassword ? (
                        <p className={styles.fieldError}>{passwordFormErrors.confirmPassword}</p>
                      ) : null}
                    </label>
                  </>
                ) : null}

                {passwordApiError ? <p className={styles.fieldError}>{passwordApiError}</p> : null}

                <div className={styles.footerActions}>
                  <button type="submit" className={styles.saveButton} disabled={isSubmittingPassword}>
                    {isSubmittingPassword ? 'Processing...' : submitPasswordLabel}
                  </button>
                </div>

                {changePasswordStep === 'otp' ? (
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={() => {
                      void handleResendOtp()
                    }}
                    disabled={isSubmittingPassword || resendSecondsLeft > 0}
                  >
                    {resendSecondsLeft > 0
                      ? `Resend OTP in ${formatCountdownTime(resendSecondsLeft)}`
                      : 'Resend OTP'}
                  </button>
                ) : null}

                {changePasswordStep !== 'request' ? (
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={handlePasswordSecondaryAction}
                    disabled={isSubmittingPassword}
                  >
                    {changePasswordStep === 'password' ? 'Back to OTP' : 'Back'}
                  </button>
                ) : null}
              </form>
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  )
}

export default ProfileSettingsPage
