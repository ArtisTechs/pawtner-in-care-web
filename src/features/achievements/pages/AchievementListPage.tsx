import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { FaAward, FaEdit, FaPlus, FaTimes, FaTrashAlt } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'
import { APP_ROUTES } from '@/app/routes/route-paths'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { achievementService } from '@/features/achievements/services/achievement.service'
import type { Achievement, CreateAchievementPayload } from '@/features/achievements/types/achievement-api'
import { defaultHeaderProfile, sidebarBottomItems, sidebarLogo, sidebarMenuItems } from '@/layouts/config/navigation'
import Header from '@/layouts/Header/Header'
import MainLayout from '@/layouts/MainLayout/MainLayout'
import Sidebar from '@/layouts/Sidebar/Sidebar'
import { getErrorMessage } from '@/shared/api/api-error'
import Toast from '@/shared/components/feedback/Toast'
import PhotoUploadField from '@/shared/components/media/PhotoUploadField/PhotoUploadField'
import ConfirmModal from '@/shared/components/ui/ConfirmModal/ConfirmModal'
import { useHeaderProfile } from '@/shared/hooks/useHeaderProfile'
import { useResponsiveSidebar } from '@/shared/hooks/useResponsiveSidebar'
import { useToast } from '@/shared/hooks/useToast'
import type { SidebarItemKey } from '@/shared/types/layout'
import styles from './AchievementListPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'achievement-list'

const CATEGORY_OPTIONS = [
  'REGISTRATION',
  'DONATION_LOGS',
  'ADOPTION_LOGS',
  'EMERGENCY_SOS',
  'COMMUNITY',
  'ACCOUNT_DAYS',
  'GIFT_LOGS',
]
const RARITY_OPTIONS = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY']
const REQUIRED_FIELDS_ERROR_MESSAGE = 'Please complete all required fields.'
const PNG_IMAGE_PATTERN = /\.png(?:$|[?#])/i
const BLACK_BACKGROUND_THRESHOLD = 22
const LOW_SATURATION_THRESHOLD = 16
const sanitizedPngIconCache = new Map<string, string>()

type CreateAchievementForm = {
  assignmentType: string
  category: string
  code: string
  description: string
  iconUrl: string
  isActive: string
  points: string
  requiredValue: string
  rarity: string
  title: string
}

type CreateAchievementFormErrorKey =
  | 'category'
  | 'code'
  | 'description'
  | 'iconUrl'
  | 'points'
  | 'requiredValue'
  | 'title'
type CreateAchievementFormErrors = Record<CreateAchievementFormErrorKey, string>

const DEFAULT_CREATE_FORM: CreateAchievementForm = {
  assignmentType: 'AUTO',
  category: 'DONATION_LOGS',
  code: '',
  description: '',
  iconUrl: '',
  isActive: 'true',
  points: '100',
  requiredValue: '5000',
  rarity: 'COMMON',
  title: '',
}

const createEmptyCreateFormErrors = (): CreateAchievementFormErrors => ({
  category: '',
  code: '',
  description: '',
  iconUrl: '',
  points: '',
  requiredValue: '',
  title: '',
})

const toDisplayText = (value?: string | null) => {
  if (!value) {
    return 'N/A'
  }

  return value
    .toLowerCase()
    .split('_')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ')
}

const normalizeText = (value?: string | null) => value?.trim() || ''

const isPngImageSource = (value: string) =>
  value.startsWith('data:image/png') || PNG_IMAGE_PATTERN.test(value)

const removePngBlackBackground = (source: string): Promise<string> => {
  if (!isPngImageSource(source) || typeof window === 'undefined') {
    return Promise.resolve(source)
  }

  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight

        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) {
          resolve(source)
          return
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
        const pixelData = imageData.data

        for (let index = 0; index < pixelData.length; index += 4) {
          const red = pixelData[index]
          const green = pixelData[index + 1]
          const blue = pixelData[index + 2]
          const alpha = pixelData[index + 3]

          if (alpha === 0) {
            continue
          }

          const maxChannel = Math.max(red, green, blue)
          const minChannel = Math.min(red, green, blue)
          const channelSpread = maxChannel - minChannel
          const isNearBlack = maxChannel <= BLACK_BACKGROUND_THRESHOLD
          const isLowSaturation = channelSpread <= LOW_SATURATION_THRESHOLD

          if (isNearBlack && isLowSaturation) {
            pixelData[index + 3] = 0
          }
        }

        context.putImageData(imageData, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(source)
      }
    }

    image.onerror = () => {
      resolve(source)
    }

    image.src = source
  })
}

const toFormattedDate = (value?: string | null) => {
  if (!value) {
    return 'N/A'
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return 'N/A'
  }

  return parsedDate.toLocaleString('en-PH', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const formatPoints = (value?: number | string | null) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString('en-PH')
  }

  if (typeof value === 'string') {
    const parsedValue = Number.parseFloat(value)
    if (Number.isFinite(parsedValue)) {
      return parsedValue.toLocaleString('en-PH')
    }
  }

  return '0'
}

const formatRequiredValue = (value?: number | string | null) => {
  if (value === null || value === undefined || value === '') {
    return 'N/A'
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString('en-PH')
  }

  if (typeof value === 'string') {
    const parsedValue = Number.parseFloat(value)
    if (Number.isFinite(parsedValue)) {
      return parsedValue.toLocaleString('en-PH')
    }
  }

  return 'N/A'
}

const getRarityStyleClass = (rarity?: string | null) => {
  const normalizedRarity = normalizeText(rarity).toUpperCase()

  if (normalizedRarity === 'LEGENDARY') {
    return styles.legendaryBadge
  }

  if (normalizedRarity === 'EPIC') {
    return styles.epicBadge
  }

  if (normalizedRarity === 'RARE') {
    return styles.rareBadge
  }

  if (normalizedRarity === 'UNCOMMON') {
    return styles.uncommonBadge
  }

  if (normalizedRarity === 'COMMON') {
    return styles.commonBadge
  }

  return styles.defaultBadge
}

const resolveCardTitle = (achievement: Achievement) =>
  normalizeText(achievement.title) || normalizeText(achievement.code) || 'Untitled Achievement'

const resolveCardCode = (achievement: Achievement) => normalizeText(achievement.code) || 'No Code'

const resolveCardDescription = (achievement: Achievement) =>
  normalizeText(achievement.description) || 'No description available.'

const mapAchievementToForm = (achievement: Achievement): CreateAchievementForm => {
  const normalizedPoints = Number.parseInt(String(achievement.points ?? '').trim(), 10)

  return {
    assignmentType:
      normalizeText(achievement.assignmentType).toUpperCase() || DEFAULT_CREATE_FORM.assignmentType,
    category: normalizeText(achievement.category).toUpperCase() || DEFAULT_CREATE_FORM.category,
    code: normalizeText(achievement.code),
    description: normalizeText(achievement.description),
    iconUrl: normalizeText(achievement.iconUrl),
    isActive: achievement.isActive === false ? 'false' : 'true',
    points: Number.isFinite(normalizedPoints) ? String(normalizedPoints) : DEFAULT_CREATE_FORM.points,
    requiredValue: normalizeText(String(achievement.requiredValue ?? '')),
    rarity: normalizeText(achievement.rarity).toUpperCase() || DEFAULT_CREATE_FORM.rarity,
    title: normalizeText(achievement.title),
  }
}

interface AchievementListPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

function AchievementListPage({ onLogout, session }: AchievementListPageProps) {
  const navigate = useNavigate()
  const { clearToast, showToast, toast } = useToast()
  const [searchValue, setSearchValue] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [isLoadingAchievements, setIsLoadingAchievements] = useState(false)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [viewingAchievement, setViewingAchievement] = useState<Achievement | null>(null)
  const [editingAchievementId, setEditingAchievementId] = useState<string | null>(null)
  const [achievementIdBeingDeleted, setAchievementIdBeingDeleted] = useState<string | null>(null)
  const [pendingDeleteAchievement, setPendingDeleteAchievement] = useState<{
    id: string
    title: string
  } | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isSavingAchievement, setIsSavingAchievement] = useState(false)
  const [createForm, setCreateForm] = useState<CreateAchievementForm>(DEFAULT_CREATE_FORM)
  const [createFormErrors, setCreateFormErrors] = useState<CreateAchievementFormErrors>(
    createEmptyCreateFormErrors,
  )
  const [, setIconCacheVersion] = useState(0)
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const resolvedHeaderProfile = useHeaderProfile({
    fallbackProfile: defaultHeaderProfile,
    session,
  })
  const accessToken = session?.accessToken?.trim() ?? ''
  const isAutoAssignment = createForm.assignmentType === 'AUTO'

  const resolveAchievementIconSource = useCallback((iconUrl?: string | null) => {
    const normalizedIconUrl = normalizeText(iconUrl)
    if (!normalizedIconUrl) {
      return ''
    }

    return sanitizedPngIconCache.get(normalizedIconUrl) ?? normalizedIconUrl
  }, [])

  useEffect(() => {
    const debounceTimer = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim())
    }, 300)

    return () => {
      window.clearTimeout(debounceTimer)
    }
  }, [searchValue])

  const loadAchievements = useCallback(async () => {
    if (!accessToken) {
      setAchievements([])
      return
    }

    setIsLoadingAchievements(true)

    try {
      const result = await achievementService.list(accessToken, {
        ignorePagination: true,
        search: debouncedSearch || undefined,
        sortBy: 'createdAt',
        sortDir: 'desc',
      })

      setAchievements(result.items)
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsLoadingAchievements(false)
    }
  }, [accessToken, debouncedSearch, showToast])

  useEffect(() => {
    clearToast()
    void loadAchievements()
  }, [clearToast, loadAchievements])

  useEffect(() => {
    const iconSources = Array.from(
      new Set(
        achievements
          .map((achievement) => normalizeText(achievement.iconUrl))
          .filter(Boolean),
      ),
    )

    const viewingIconSource = normalizeText(viewingAchievement?.iconUrl)
    if (viewingIconSource) {
      iconSources.push(viewingIconSource)
    }

    const uncachedSources = Array.from(new Set(iconSources)).filter(
      (iconSource) => !sanitizedPngIconCache.has(iconSource),
    )

    if (!uncachedSources.length) {
      return
    }

    let isCancelled = false

    const sanitizeIconSources = async () => {
      await Promise.all(
        uncachedSources.map(async (iconSource) => {
          const sanitizedSource = await removePngBlackBackground(iconSource)
          if (isCancelled) {
            return
          }

          sanitizedPngIconCache.set(iconSource, sanitizedSource)
        }),
      )

      if (!isCancelled) {
        setIconCacheVersion((currentVersion) => currentVersion + 1)
      }
    }

    void sanitizeIconSources()

    return () => {
      isCancelled = true
    }
  }, [achievements, viewingAchievement])

  const clearCreateFormError = useCallback((field: CreateAchievementFormErrorKey) => {
    setCreateFormErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors
      }

      return {
        ...currentErrors,
        [field]: '',
      }
    })
  }, [])

  const openCreateModal = () => {
    setEditingAchievementId(null)
    setCreateForm(DEFAULT_CREATE_FORM)
    setCreateFormErrors(createEmptyCreateFormErrors())
    setIsCreateModalOpen(true)
  }

  const closeCreateModal = useCallback(() => {
    setIsCreateModalOpen(false)
    setEditingAchievementId(null)
    setIsSavingAchievement(false)
    setCreateForm(DEFAULT_CREATE_FORM)
    setCreateFormErrors(createEmptyCreateFormErrors())
  }, [])

  const closeViewModal = useCallback(() => {
    setViewingAchievement(null)
  }, [])

  const handleViewAchievement = (achievement: Achievement) => {
    setViewingAchievement(achievement)
  }

  const handleEditAchievement = (achievement: Achievement) => {
    setEditingAchievementId(achievement.id)
    setCreateForm(mapAchievementToForm(achievement))
    setCreateFormErrors(createEmptyCreateFormErrors())
    setIsCreateModalOpen(true)
  }

  const handleDeleteAchievement = (achievementId: string) => {
    if (!accessToken) {
      setPendingDeleteAchievement(null)
      showToast('You need to sign in before managing achievements.', { variant: 'error' })
      return
    }

    const deleteAchievement = async () => {
      setAchievementIdBeingDeleted(achievementId)

      try {
        await achievementService.delete(achievementId, accessToken)
        setAchievements((currentAchievements) =>
          currentAchievements.filter((achievement) => achievement.id !== achievementId),
        )
        setViewingAchievement((currentAchievement) =>
          currentAchievement?.id === achievementId ? null : currentAchievement,
        )
        showToast('Achievement deleted successfully.', { variant: 'success' })
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setPendingDeleteAchievement(null)
        setAchievementIdBeingDeleted(null)
      }
    }

    void deleteAchievement()
  }

  const handleDeleteAchievementRequest = (achievement: Achievement) => {
    setPendingDeleteAchievement({
      id: achievement.id,
      title: resolveCardTitle(achievement),
    })
  }

  const handleDeleteAchievementConfirm = () => {
    if (!pendingDeleteAchievement) {
      return
    }

    handleDeleteAchievement(pendingDeleteAchievement.id)
  }

  const handleViewEdit = () => {
    if (!viewingAchievement) {
      return
    }

    const achievementToEdit = viewingAchievement
    closeViewModal()
    handleEditAchievement(achievementToEdit)
  }

  const handleViewDelete = () => {
    if (!viewingAchievement) {
      return
    }

    handleDeleteAchievementRequest(viewingAchievement)
    closeViewModal()
  }

  const handleCreateAchievementSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!accessToken) {
      showToast('You need to sign in before managing achievements.', { variant: 'error' })
      return
    }

    const trimmedCode = createForm.code.trim()
    const trimmedTitle = createForm.title.trim()
    const trimmedDescription = createForm.description.trim()
    const trimmedIconUrl = createForm.iconUrl.trim()
    const trimmedPoints = createForm.points.trim()
    const trimmedCategory = createForm.category.trim()
    const trimmedRequiredValue = createForm.requiredValue.trim()
    const points = Number.parseInt(trimmedPoints, 10)
    const parsedRequiredValue = trimmedRequiredValue ? Number.parseFloat(trimmedRequiredValue) : null
    const isAutoAssign = createForm.assignmentType === 'AUTO'
    const isRegistrationCategory = createForm.category === 'REGISTRATION'
    const nextErrors = createEmptyCreateFormErrors()

    if (!trimmedCode) {
      nextErrors.code = REQUIRED_FIELDS_ERROR_MESSAGE
    }

    if (!trimmedTitle) {
      nextErrors.title = REQUIRED_FIELDS_ERROR_MESSAGE
    }

    if (!trimmedDescription) {
      nextErrors.description = REQUIRED_FIELDS_ERROR_MESSAGE
    }

    if (!trimmedIconUrl) {
      nextErrors.iconUrl = REQUIRED_FIELDS_ERROR_MESSAGE
    }

    if (!trimmedPoints || !Number.isFinite(points) || points < 0) {
      nextErrors.points = 'Points must be a valid positive number or zero.'
    }

    if (isAutoAssign && !trimmedCategory) {
      nextErrors.category = REQUIRED_FIELDS_ERROR_MESSAGE
    }

    if (isAutoAssign && !isRegistrationCategory && !trimmedRequiredValue) {
      nextErrors.requiredValue = REQUIRED_FIELDS_ERROR_MESSAGE
    } else if (
      parsedRequiredValue !== null &&
      (!Number.isFinite(parsedRequiredValue) || parsedRequiredValue < 0)
    ) {
      nextErrors.requiredValue = 'Required value must be a valid positive number or zero.'
    }

    const hasFormErrors = Object.values(nextErrors).some(Boolean)
    if (hasFormErrors) {
      setCreateFormErrors(nextErrors)
      showToast('Please resolve the errors before submitting.', { variant: 'error' })
      return
    }

    const createAchievement = async () => {
      setIsSavingAchievement(true)

      try {
        const payload: CreateAchievementPayload = {
          assignmentType: createForm.assignmentType,
          code: trimmedCode,
          description: trimmedDescription,
          iconUrl: trimmedIconUrl,
          isActive: createForm.isActive === 'true',
          points,
          rarity: createForm.rarity,
          title: trimmedTitle,
          ...(isAutoAssign
            ? {
                category: createForm.category,
                requiredValue: parsedRequiredValue,
              }
            : {}),
        }

        if (editingAchievementId) {
          await achievementService.update(editingAchievementId, payload, accessToken)
          showToast('Achievement updated successfully.', { variant: 'success' })
        } else {
          await achievementService.create(payload, accessToken)
          showToast('Achievement created successfully.', { variant: 'success' })
        }

        closeCreateModal()
        await loadAchievements()
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setIsSavingAchievement(false)
      }
    }

    void createAchievement()
  }

  const skeletonCardIndexes = useMemo(() => Array.from({ length: 6 }, (_, index) => index), [])

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
            setIsSidebarOpen((prevState) => !prevState)
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
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>Achievement Listing</h1>
            <button
              type="button"
              className={styles.pageHeaderButton}
              onClick={() => {
                navigate(APP_ROUTES.achievementAssignment)
              }}
            >
              Assign To Users
            </button>
          </div>

          <div className={styles.tablePanel}>
            <div className={styles.tableScroll}>
              {isLoadingAchievements ? (
                <div className={styles.cardGrid}>
                  {skeletonCardIndexes.map((skeletonIndex) => (
                    <article key={`achievement-skeleton-${skeletonIndex}`} className={styles.skeletonCard} aria-hidden="true">
                      <div className={styles.skeletonTitle} />
                      <div className={styles.skeletonLine} />
                      <div className={styles.skeletonLine} />
                      <div className={styles.skeletonMeta} />
                    </article>
                  ))}
                </div>
              ) : achievements.length === 0 ? (
                <div className={styles.tableStateWrap}>
                  <div className={styles.tableStateCell}>No achievements found.</div>
                </div>
              ) : (
                <div className={styles.cardGrid}>
                  {achievements.map((achievement) => (
                    <article key={achievement.id} className={styles.card}>
                      <div className={styles.cardHeader}>
                        <div className={styles.identityWrap}>
                          <div className={styles.cardTitleWrap}>
                            <h2 className={styles.cardTitle}>{resolveCardTitle(achievement)}</h2>
                          </div>

                          <div className={styles.iconWrap}>
                            {resolveAchievementIconSource(achievement.iconUrl) ? (
                              <img
                                src={resolveAchievementIconSource(achievement.iconUrl)}
                                alt={resolveCardTitle(achievement)}
                                className={styles.iconImage}
                                loading="lazy"
                              />
                            ) : (
                              <FaAward aria-hidden="true" />
                            )}
                          </div>
                        </div>
                      </div>

                      <p className={styles.cardDescription}>{resolveCardDescription(achievement)}</p>

                      <button
                        type="button"
                        className={styles.cardViewButton}
                        onClick={() => {
                          handleViewAchievement(achievement)
                        }}
                      >
                        View
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <button type="button" className={styles.floatingAddButton} onClick={openCreateModal} aria-label="Create achievement">
              <span className={styles.floatingAddIcon} aria-hidden="true">
                <FaPlus />
              </span>
              <span className={styles.floatingAddLabel}>Create Achievement</span>
            </button>
          </div>

          {viewingAchievement ? (
            <div
              className={styles.modalOverlay}
              onClick={() => {
                closeViewModal()
              }}
            >
              <div
                className={`${styles.modalCard} ${styles.viewModalCard}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="view-achievement-modal-title"
                onClick={(event) => {
                  event.stopPropagation()
                }}
              >
                <div className={styles.modalHeader}>
                  <h2 id="view-achievement-modal-title" className={styles.modalTitle}>
                    Achievement Details
                  </h2>
                  <button
                    type="button"
                    className={styles.modalCloseButton}
                    onClick={() => {
                      closeViewModal()
                    }}
                    aria-label="Close achievement details modal"
                  >
                    <FaTimes aria-hidden="true" />
                  </button>
                </div>

                <div className={styles.viewModalBody}>
                  <div className={styles.viewAchievementTop}>
                    <div className={styles.viewAchievementIcon}>
                      {resolveAchievementIconSource(viewingAchievement.iconUrl) ? (
                        <img
                          src={resolveAchievementIconSource(viewingAchievement.iconUrl)}
                          alt={resolveCardTitle(viewingAchievement)}
                          className={styles.viewAchievementImage}
                          loading="lazy"
                        />
                      ) : (
                        <FaAward aria-hidden="true" />
                      )}
                    </div>

                    <div className={styles.viewAchievementTitleWrap}>
                      <h3 className={styles.viewAchievementTitle}>{resolveCardTitle(viewingAchievement)}</h3>
                      <p className={styles.viewAchievementDescription}>{resolveCardDescription(viewingAchievement)}</p>
                    </div>
                  </div>

                  <div className={styles.badgeList}>
                    <span className={`${styles.badge} ${getRarityStyleClass(viewingAchievement.rarity)}`}>
                      {toDisplayText(normalizeText(viewingAchievement.rarity) || 'UNKNOWN')}
                    </span>
                    <span
                      className={`${styles.badge} ${
                        viewingAchievement.isActive ? styles.activeBadge : styles.inactiveBadge
                      }`}
                    >
                      {viewingAchievement.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className={styles.metricRow}>
                    <div className={styles.metricItem}>
                      <span className={styles.metricLabel}>Points</span>
                      <span className={styles.metricValue}>{formatPoints(viewingAchievement.points)}</span>
                    </div>
                    <div className={styles.metricItem}>
                      <span className={styles.metricLabel}>Assignment</span>
                      <span className={styles.metricValue}>{toDisplayText(viewingAchievement.assignmentType)}</span>
                    </div>
                    <div className={styles.metricItem}>
                      <span className={styles.metricLabel}>Required Value</span>
                      <span className={styles.metricValue}>{formatRequiredValue(viewingAchievement.requiredValue)}</span>
                    </div>
                  </div>

                  <dl className={styles.metaGrid}>
                    <div className={styles.metaItem}>
                      <dt>Code</dt>
                      <dd>{resolveCardCode(viewingAchievement)}</dd>
                    </div>
                    <div className={styles.metaItem}>
                      <dt>Category</dt>
                      <dd>{toDisplayText(viewingAchievement.category)}</dd>
                    </div>
                    <div className={styles.metaItem}>
                      <dt>Required Value</dt>
                      <dd>{formatRequiredValue(viewingAchievement.requiredValue)}</dd>
                    </div>
                  </dl>

                  <div className={styles.cardFooter}>
                    <span>Created: {toFormattedDate(viewingAchievement.createdAt ?? viewingAchievement.createdDate)}</span>
                    <span>Updated: {toFormattedDate(viewingAchievement.updatedAt ?? viewingAchievement.updatedDate)}</span>
                  </div>
                </div>

                <div className={`${styles.modalActions} ${styles.viewModalActions}`}>
                  <button
                    type="button"
                    className={styles.modalCancelButton}
                    onClick={() => {
                      closeViewModal()
                    }}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className={styles.modalSubmitButton}
                    onClick={() => {
                      handleViewEdit()
                    }}
                  >
                    <FaEdit aria-hidden="true" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.modalSubmitButton} ${styles.viewDeleteButton}`}
                    onClick={() => {
                      handleViewDelete()
                    }}
                  >
                    <FaTrashAlt aria-hidden="true" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {isCreateModalOpen ? (
            <div
              className={styles.modalOverlay}
              onClick={(event) => {
                if (event.target === event.currentTarget && !isSavingAchievement) {
                  closeCreateModal()
                }
              }}
            >
              <div
                className={styles.modalCard}
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-achievement-modal-title"
                onClick={(event) => {
                  event.stopPropagation()
                }}
              >
                <div className={styles.modalHeader}>
                  <h2 id="create-achievement-modal-title" className={styles.modalTitle}>
                    {editingAchievementId ? 'Edit Achievement' : 'Create Achievement'}
                  </h2>
                  <button
                    type="button"
                    className={styles.modalCloseButton}
                    onClick={() => {
                      closeCreateModal()
                    }}
                    disabled={isSavingAchievement}
                    aria-label={editingAchievementId ? 'Close edit achievement modal' : 'Close create achievement modal'}
                  >
                    <FaTimes aria-hidden="true" />
                  </button>
                </div>

                <form className={styles.modalForm} onSubmit={handleCreateAchievementSubmit} noValidate>
                  <div className={styles.modalFields}>
                    <label className={styles.fieldLabel}>
                      <span>
                        Code <span className={styles.requiredMark}>*</span>
                      </span>
                      <input
                        className={`${styles.fieldInput} ${createFormErrors.code ? styles.fieldInputError : ''}`}
                        type="text"
                        value={createForm.code}
                        onChange={(event) => {
                          clearCreateFormError('code')
                          setCreateForm((currentForm) => ({
                            ...currentForm,
                            code: event.target.value.toUpperCase(),
                          }))
                        }}
                        disabled={isSavingAchievement}
                        placeholder="FIRST_ADOPTION"
                      />
                      {createFormErrors.code ? <span className={styles.fieldErrorText}>{createFormErrors.code}</span> : null}
                    </label>

                    <label className={styles.fieldLabel}>
                      <span>
                        Title <span className={styles.requiredMark}>*</span>
                      </span>
                      <input
                        className={`${styles.fieldInput} ${createFormErrors.title ? styles.fieldInputError : ''}`}
                        type="text"
                        value={createForm.title}
                        onChange={(event) => {
                          clearCreateFormError('title')
                          setCreateForm((currentForm) => ({
                            ...currentForm,
                            title: event.target.value,
                          }))
                        }}
                        disabled={isSavingAchievement}
                        placeholder="Top Rescue Supporter"
                      />
                      {createFormErrors.title ? (
                        <span className={styles.fieldErrorText}>{createFormErrors.title}</span>
                      ) : null}
                    </label>

                    <label className={`${styles.fieldLabel} ${styles.fullWidthField}`}>
                      <span>
                        Description <span className={styles.requiredMark}>*</span>
                      </span>
                      <textarea
                        className={`${styles.fieldTextarea} ${createFormErrors.description ? styles.fieldInputError : ''}`}
                        value={createForm.description}
                        onChange={(event) => {
                          clearCreateFormError('description')
                          setCreateForm((currentForm) => ({
                            ...currentForm,
                            description: event.target.value,
                          }))
                        }}
                        disabled={isSavingAchievement}
                        style={{ resize: 'none' }}
                        rows={3}
                        placeholder="Awarded to a supporter who reached 10 donation actions."
                      />
                      {createFormErrors.description ? (
                        <span className={styles.fieldErrorText}>{createFormErrors.description}</span>
                      ) : null}
                    </label>

                    <div className={`${styles.uploadFieldWrap} ${styles.fullWidthField}`}>
                      <PhotoUploadField
                        value={createForm.iconUrl}
                        onChange={(nextPhoto) => {
                          clearCreateFormError('iconUrl')
                          setCreateForm((currentForm) => ({
                            ...currentForm,
                            iconUrl: nextPhoto,
                          }))
                        }}
                        onNotify={(message, variant) => {
                          showToast(message, { variant })
                        }}
                        title="Icon Photo"
                        subtitle="Upload the achievement icon from your device or camera."
                        previewAlt={createForm.title ? `${createForm.title} icon` : 'Achievement icon preview'}
                        uploadFolder="achievements"
                        disabled={isSavingAchievement}
                        cropAspectRatio={1}
                      />
                      <span className={styles.uploadRequiredLabel}>
                        Required <span className={styles.requiredMark}>*</span>
                      </span>
                      {createFormErrors.iconUrl ? (
                        <span className={styles.fieldErrorText}>{createFormErrors.iconUrl}</span>
                      ) : null}
                    </div>

                    <div className={`${styles.toggleRow} ${styles.fullWidthField}`}>
                      <label className={styles.toggleCard}>
                        <span className={styles.toggleCopy}>
                          <span className={styles.toggleLabel}>Auto Assign</span>
                          <span className={styles.toggleHint}>Enable category-based auto evaluation.</span>
                        </span>
                        <input
                          className={styles.toggleInput}
                          type="checkbox"
                          checked={isAutoAssignment}
                          onChange={(event) => {
                            clearCreateFormError('category')
                            clearCreateFormError('requiredValue')
                            const nextIsAuto = event.target.checked
                            setCreateForm((currentForm) => ({
                              ...currentForm,
                              assignmentType: nextIsAuto ? 'AUTO' : 'MANUAL',
                              category: nextIsAuto
                                ? currentForm.category || DEFAULT_CREATE_FORM.category
                                : '',
                              requiredValue: nextIsAuto
                                ? currentForm.requiredValue || DEFAULT_CREATE_FORM.requiredValue
                                : '',
                            }))
                          }}
                          disabled={isSavingAchievement}
                        />
                        <span className={styles.toggleTrack} aria-hidden="true">
                          <span className={styles.toggleThumb} />
                        </span>
                      </label>
                      <label className={styles.toggleCard}>
                        <span className={styles.toggleCopy}>
                          <span className={styles.toggleLabel}>Is Active</span>
                          <span className={styles.toggleHint}>Controls visibility in active listings.</span>
                        </span>
                        <input
                          className={styles.toggleInput}
                          type="checkbox"
                          checked={createForm.isActive === 'true'}
                          onChange={(event) => {
                            setCreateForm((currentForm) => ({
                              ...currentForm,
                              isActive: event.target.checked ? 'true' : 'false',
                            }))
                          }}
                          disabled={isSavingAchievement}
                        />
                        <span className={styles.toggleTrack} aria-hidden="true">
                          <span className={styles.toggleThumb} />
                        </span>
                      </label>
                    </div>

                    <label className={styles.fieldLabel}>
                      <span>
                        Points <span className={styles.requiredMark}>*</span>
                      </span>
                      <input
                        className={`${styles.fieldInput} ${createFormErrors.points ? styles.fieldInputError : ''}`}
                        type="number"
                        min={0}
                        step={1}
                        value={createForm.points}
                        onChange={(event) => {
                          clearCreateFormError('points')
                          setCreateForm((currentForm) => ({
                            ...currentForm,
                            points: event.target.value,
                          }))
                        }}
                        disabled={isSavingAchievement}
                      />
                      {createFormErrors.points ? (
                        <span className={styles.fieldErrorText}>{createFormErrors.points}</span>
                      ) : null}
                    </label>

                    <label className={styles.fieldLabel}>
                      <span>Rarity</span>
                      <select
                        className={styles.fieldInput}
                        value={createForm.rarity}
                        onChange={(event) => {
                          setCreateForm((currentForm) => ({
                            ...currentForm,
                            rarity: event.target.value,
                          }))
                        }}
                        disabled={isSavingAchievement}
                      >
                        {RARITY_OPTIONS.map((rarityOption) => (
                          <option key={rarityOption} value={rarityOption}>
                            {toDisplayText(rarityOption)}
                          </option>
                        ))}
                      </select>
                    </label>

                    {isAutoAssignment ? (
                      <section className={`${styles.autoConfigPanel} ${styles.fullWidthField}`}>
                        <div className={styles.autoConfigHeader}>
                          <span className={styles.autoConfigTitle}>Automatic Evaluation</span>
                          <span className={styles.autoConfigHint}>
                            Set the category and threshold for auto unlock.
                          </span>
                        </div>
                        <div className={styles.autoConfigGrid}>
                          <label className={styles.fieldLabel}>
                            <span>
                              Category <span className={styles.requiredMark}>*</span>
                            </span>
                            <select
                              className={`${styles.fieldInput} ${createFormErrors.category ? styles.fieldInputError : ''}`}
                              value={createForm.category}
                              onChange={(event) => {
                                clearCreateFormError('category')
                                clearCreateFormError('requiredValue')
                                const nextCategory = event.target.value
                                setCreateForm((currentForm) => ({
                                  ...currentForm,
                                  category: nextCategory,
                                  requiredValue:
                                    nextCategory === 'REGISTRATION' ? '' : currentForm.requiredValue,
                                }))
                              }}
                              disabled={isSavingAchievement}
                            >
                              {CATEGORY_OPTIONS.map((categoryOption) => (
                                <option key={categoryOption} value={categoryOption}>
                                  {toDisplayText(categoryOption)}
                                </option>
                              ))}
                            </select>
                            {createFormErrors.category ? (
                              <span className={styles.fieldErrorText}>{createFormErrors.category}</span>
                            ) : null}
                          </label>
                          <label className={styles.fieldLabel}>
                            <span>
                              Required Value
                              {createForm.category !== 'REGISTRATION' ? (
                                <span className={styles.requiredMark}>*</span>
                              ) : null}
                            </span>
                            <input
                              className={`${styles.fieldInput} ${createFormErrors.requiredValue ? styles.fieldInputError : ''}`}
                              type="number"
                              min={0}
                              step="any"
                              value={createForm.requiredValue}
                              onChange={(event) => {
                                clearCreateFormError('requiredValue')
                                setCreateForm((currentForm) => ({
                                  ...currentForm,
                                  requiredValue: event.target.value,
                                }))
                              }}
                              disabled={isSavingAchievement}
                              placeholder={
                                createForm.category === 'REGISTRATION'
                                  ? 'Optional for registration achievements'
                                  : 'e.g. 5000'
                              }
                            />
                            {createFormErrors.requiredValue ? (
                              <span className={styles.fieldErrorText}>{createFormErrors.requiredValue}</span>
                            ) : null}
                          </label>
                        </div>
                      </section>
                    ) : (
                      <div className={`${styles.autoConfigEmpty} ${styles.fullWidthField}`}>
                        Manual assignment mode is on. Category and required value are hidden.
                      </div>
                    )}
                  </div>

                  <div className={styles.modalActions}>
                    <div className={styles.modalButtonRow}>
                      <button
                        type="button"
                        className={styles.modalCancelButton}
                        onClick={() => {
                          closeCreateModal()
                        }}
                        disabled={isSavingAchievement}
                      >
                        Cancel
                      </button>

                      <button type="submit" className={styles.modalSubmitButton} disabled={isSavingAchievement}>
                        {isSavingAchievement
                          ? editingAchievementId
                            ? 'Saving...'
                            : 'Creating...'
                          : editingAchievementId
                            ? 'Save Changes'
                            : 'Create Achievement'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <ConfirmModal
        isOpen={Boolean(pendingDeleteAchievement)}
        title="Delete achievement?"
        message={`Are you sure you want to delete ${pendingDeleteAchievement?.title ?? 'this achievement'}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        ariaLabel="Delete achievement confirmation"
        isBusy={achievementIdBeingDeleted !== null}
        onCancel={() => {
          setPendingDeleteAchievement(null)
        }}
        onConfirm={handleDeleteAchievementConfirm}
      />
    </MainLayout>
  )
}

export default AchievementListPage
