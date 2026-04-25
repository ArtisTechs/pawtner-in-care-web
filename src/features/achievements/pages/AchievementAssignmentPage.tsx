import { useCallback, useEffect, useMemo, useState } from 'react'
import { FaAward, FaCheck, FaUsers } from 'react-icons/fa'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { achievementService } from '@/features/achievements/services/achievement.service'
import type { Achievement } from '@/features/achievements/types/achievement-api'
import { userService } from '@/features/users/services/user.service'
import type { User } from '@/features/users/types/user-api'
import { resolveUserDisplayName, resolveUserRoleLabel, resolveUserRoleValue } from '@/features/users/utils/user-form'
import { defaultHeaderProfile, sidebarBottomItems, sidebarLogo, sidebarMenuItems } from '@/layouts/config/navigation'
import Header from '@/layouts/Header/Header'
import MainLayout from '@/layouts/MainLayout/MainLayout'
import Sidebar from '@/layouts/Sidebar/Sidebar'
import { getErrorMessage } from '@/shared/api/api-error'
import Toast from '@/shared/components/feedback/Toast'
import { useHeaderProfile } from '@/shared/hooks/useHeaderProfile'
import { useResponsiveSidebar } from '@/shared/hooks/useResponsiveSidebar'
import { useToast } from '@/shared/hooks/useToast'
import type { SidebarItemKey } from '@/shared/types/layout'
import styles from './AchievementAssignmentPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'achievement-assignment'

const ASSIGNMENT_FILTER_OPTIONS = ['ALL', 'MANUAL', 'AUTO'] as const
const USER_ASSIGNMENT_FILTER_OPTIONS = ['UNASSIGNED', 'ASSIGNED'] as const
type AssignmentFilterValue = (typeof ASSIGNMENT_FILTER_OPTIONS)[number]
type UserAssignmentFilterValue = (typeof USER_ASSIGNMENT_FILTER_OPTIONS)[number]
type UserAchievementLinkStatus = 'ASSIGNED' | 'UNASSIGNED' | 'UNKNOWN'

type UserAchievementLinkState = {
  status: UserAchievementLinkStatus
  userAchievementId: string | null
}

const normalizeText = (value?: string | null) => value?.trim() || ''

const toDisplayText = (value?: string | null) => {
  if (!value) {
    return 'N/A'
  }

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const resolveAchievementTitle = (achievement: Achievement) =>
  normalizeText(achievement.title) || normalizeText(achievement.code) || 'Untitled Achievement'

const resolveAchievementDescription = (achievement: Achievement) =>
  normalizeText(achievement.description) || 'No description available.'

const alphabeticalCollator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base',
})

const compareAlphabetical = (leftValue: string, rightValue: string) =>
  alphabeticalCollator.compare(leftValue, rightValue)

const resolveAchievementPoints = (achievement: Achievement) => {
  const numericPoints =
    typeof achievement.points === 'number' ? achievement.points : Number.parseFloat(String(achievement.points ?? ''))

  if (!Number.isFinite(numericPoints)) {
    return '0'
  }

  return numericPoints.toLocaleString('en-PH')
}

const resolveUserIsActive = (user: User) => {
  if (typeof user.active === 'boolean') {
    return user.active
  }

  return resolveUserRoleValue(user.role) === 'USER'
}

type UserRow = {
  email: string
  id: string
  isActive: boolean
  name: string
  roleLabel: string
  searchableText: string
}

const mapUserToRow = (user: User): UserRow => {
  const id = normalizeText(user.id)
  const name = resolveUserDisplayName(user) || normalizeText(user.email) || id || 'Unknown User'
  const email = normalizeText(user.email)
  const roleLabel = resolveUserRoleLabel(user.role)
  const isActive = resolveUserIsActive(user)

  return {
    email,
    id,
    isActive,
    name,
    roleLabel,
    searchableText: [name, email, id, roleLabel].join(' ').toLowerCase(),
  }
}

const sortAchievementsAlphabetically = (items: Achievement[]) =>
  [...items].sort((leftAchievement, rightAchievement) => {
    const titleResult = compareAlphabetical(
      resolveAchievementTitle(leftAchievement),
      resolveAchievementTitle(rightAchievement),
    )
    if (titleResult !== 0) {
      return titleResult
    }

    return compareAlphabetical(normalizeText(leftAchievement.code), normalizeText(rightAchievement.code))
  })

const sortUserRowsAlphabetically = (items: UserRow[]) =>
  [...items].sort((leftRow, rightRow) => {
    const nameResult = compareAlphabetical(leftRow.name, rightRow.name)
    if (nameResult !== 0) {
      return nameResult
    }

    return compareAlphabetical(leftRow.email, rightRow.email)
  })

interface AchievementAssignmentPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

function AchievementAssignmentPage({ onLogout, session }: AchievementAssignmentPageProps) {
  const { clearToast, showToast, toast } = useToast()
  const [headerSearchValue, setHeaderSearchValue] = useState('')
  const [achievementSearchValue, setAchievementSearchValue] = useState('')
  const [userSearchValue, setUserSearchValue] = useState('')
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilterValue>('ALL')
  const [userAssignmentFilter, setUserAssignmentFilter] = useState<UserAssignmentFilterValue>('UNASSIGNED')
  const [isLoadingAchievements, setIsLoadingAchievements] = useState(false)
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [isLoadingUserAssignments, setIsLoadingUserAssignments] = useState(false)
  const [isAssigningAchievement, setIsAssigningAchievement] = useState(false)
  const [isUnassigningAchievement, setIsUnassigningAchievement] = useState(false)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [userRows, setUserRows] = useState<UserRow[]>([])
  const [selectedAchievementId, setSelectedAchievementId] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [userAssignmentStateByUserId, setUserAssignmentStateByUserId] = useState<
    Record<string, UserAchievementLinkState>
  >({})
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const resolvedHeaderProfile = useHeaderProfile({
    fallbackProfile: defaultHeaderProfile,
    session,
  })
  const accessToken = session?.accessToken?.trim() ?? ''

  const loadAchievements = useCallback(async () => {
    if (!accessToken) {
      setAchievements([])
      setSelectedAchievementId('')
      return
    }

    setIsLoadingAchievements(true)

    try {
      const result = await achievementService.list(accessToken, {
        ignorePagination: true,
        isActive: true,
        sortBy: 'createdAt',
        sortDir: 'desc',
      })
      const nextAchievements = sortAchievementsAlphabetically(
        result.items.filter((achievement) => achievement.isActive !== false),
      )
      setAchievements(nextAchievements)
      setSelectedAchievementId((currentId) => {
        if (currentId && nextAchievements.some((achievement) => achievement.id === currentId)) {
          return currentId
        }

        return nextAchievements[0]?.id ?? ''
      })
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsLoadingAchievements(false)
    }
  }, [accessToken, showToast])

  const loadUsers = useCallback(async () => {
    if (!accessToken) {
      setUserRows([])
      setSelectedUserIds([])
      return
    }

    setIsLoadingUsers(true)

    try {
      const users = await userService.list(accessToken, {
        page: 0,
        size: 500,
        sortBy: 'lastName',
        sortDir: 'asc',
      })
      const nextRows = users
        .map(mapUserToRow)
        .filter((row) => Boolean(row.id))
      const sortedRows = sortUserRowsAlphabetically(nextRows)
      setUserRows(sortedRows)
      setSelectedUserIds((currentIds) => currentIds.filter((id) => sortedRows.some((row) => row.id === id)))
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsLoadingUsers(false)
    }
  }, [accessToken, showToast])

  const refreshData = useCallback(async () => {
    await Promise.all([loadAchievements(), loadUsers()])
  }, [loadAchievements, loadUsers])

  useEffect(() => {
    clearToast()

    if (!accessToken) {
      setAchievements([])
      setUserRows([])
      setSelectedAchievementId('')
      setSelectedUserIds([])
      setUserAssignmentStateByUserId({})
      return
    }

    void refreshData()
  }, [accessToken, clearToast, refreshData])

  useEffect(() => {
    setSelectedUserIds([])
  }, [selectedAchievementId, userAssignmentFilter])

  const filteredAchievements = useMemo(() => {
    const normalizedSearch = achievementSearchValue.trim().toLowerCase()

    return achievements.filter((achievement) => {
      const assignmentType = normalizeText(achievement.assignmentType).toUpperCase()
      if (assignmentFilter !== 'ALL' && assignmentType !== assignmentFilter) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      const searchableText = [
        normalizeText(achievement.title),
        normalizeText(achievement.code),
        normalizeText(achievement.category),
        normalizeText(achievement.rarity),
      ]
        .join(' ')
        .toLowerCase()

      return searchableText.includes(normalizedSearch)
    })
  }, [achievementSearchValue, achievements, assignmentFilter])

  const selectedAchievement = useMemo(
    () => achievements.find((achievement) => achievement.id === selectedAchievementId) ?? null,
    [achievements, selectedAchievementId],
  )

  useEffect(() => {
    if (!accessToken || !selectedAchievement || userRows.length === 0) {
      setUserAssignmentStateByUserId({})
      setIsLoadingUserAssignments(false)
      return
    }

    let isCancelled = false
    setIsLoadingUserAssignments(true)
    setUserAssignmentStateByUserId({})

    const loadUserAssignmentStates = async () => {
      try {
        const assignedUsers = await achievementService.listAssignedUsersByAchievement(selectedAchievement.id, accessToken)
        if (isCancelled) {
          return
        }

        const assignedByUserId = new Map<string, string>()
        assignedUsers.forEach((assignedUser) => {
          const userId = normalizeText(assignedUser.userId)
          const userAchievementId = normalizeText(assignedUser.userAchievementId)
          if (!userId || !userAchievementId || assignedByUserId.has(userId)) {
            return
          }

          assignedByUserId.set(userId, userAchievementId)
        })

        const nextAssignments: Record<string, UserAchievementLinkState> = {}
        userRows.forEach((row) => {
          const userAchievementId = assignedByUserId.get(row.id) || null
          nextAssignments[row.id] = userAchievementId
            ? {
                status: 'ASSIGNED',
                userAchievementId,
              }
            : {
                status: 'UNASSIGNED',
                userAchievementId: null,
              }
        })

        if (isCancelled) {
          return
        }

        setUserAssignmentStateByUserId(nextAssignments)
      } catch {
        if (isCancelled) {
          return
        }

        const nextAssignments: Record<string, UserAchievementLinkState> = {}
        userRows.forEach((row) => {
          nextAssignments[row.id] = {
            status: 'UNKNOWN',
            userAchievementId: null,
          }
        })

        setUserAssignmentStateByUserId(nextAssignments)
      } finally {
        if (!isCancelled) {
          setIsLoadingUserAssignments(false)
        }
      }
    }

    void loadUserAssignmentStates()

    return () => {
      isCancelled = true
    }
  }, [accessToken, selectedAchievement, userRows])

  const filteredUserRows = useMemo(() => {
    const normalizedSearch = userSearchValue.trim().toLowerCase()
    const searchedRows = normalizedSearch
      ? userRows.filter((row) => row.searchableText.includes(normalizedSearch))
      : userRows

    if (!selectedAchievement) {
      return searchedRows
    }

    return searchedRows.filter((row) => {
      const assignmentState = userAssignmentStateByUserId[row.id]
      if (!assignmentState) {
        return false
      }

      if (userAssignmentFilter === 'ASSIGNED') {
        return assignmentState.status === 'ASSIGNED'
      }

      return assignmentState.status === 'UNASSIGNED'
    })
  }, [selectedAchievement, userAssignmentFilter, userAssignmentStateByUserId, userRows, userSearchValue])

  const selectedUserIdSet = useMemo(() => new Set(selectedUserIds), [selectedUserIds])

  const areAllFilteredUsersSelected = useMemo(() => {
    if (filteredUserRows.length === 0) {
      return false
    }

    return filteredUserRows.every((row) => selectedUserIdSet.has(row.id))
  }, [filteredUserRows, selectedUserIdSet])

  const hasSomeFilteredUsersSelected = useMemo(
    () => filteredUserRows.some((row) => selectedUserIdSet.has(row.id)),
    [filteredUserRows, selectedUserIdSet],
  )

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((currentIds) => {
      if (currentIds.includes(userId)) {
        return currentIds.filter((currentId) => currentId !== userId)
      }

      return [...currentIds, userId]
    })
  }

  const toggleSelectAllFilteredUsers = () => {
    if (!filteredUserRows.length) {
      return
    }

    setSelectedUserIds((currentIds) => {
      const nextIds = new Set(currentIds)
      const shouldClearFilteredRows = filteredUserRows.every((row) => nextIds.has(row.id))

      filteredUserRows.forEach((row) => {
        if (shouldClearFilteredRows) {
          nextIds.delete(row.id)
        } else {
          nextIds.add(row.id)
        }
      })

      return Array.from(nextIds)
    })
  }

  const isProcessingAction = isAssigningAchievement || isUnassigningAchievement
  const isAssignMode = userAssignmentFilter === 'UNASSIGNED'

  const isActionButtonDisabled =
    !selectedAchievement ||
    !selectedUserIds.length ||
    isProcessingAction ||
    isLoadingUserAssignments

  const actionButtonLabel =
    isAssignMode
      ? isAssigningAchievement
        ? 'Assigning...'
        : 'Assign Achievement'
      : isUnassigningAchievement
        ? 'Unassigning...'
        : 'Unassign Achievement'

  const actionButtonClassName = isAssignMode ? styles.assignButton : styles.unassignButton

  const handleAssignAchievement = () => {
    if (!accessToken) {
      showToast('You need to sign in before assigning achievements.', { variant: 'error' })
      return
    }

    if (!selectedAchievement) {
      showToast('Select an achievement to continue.', { variant: 'error' })
      return
    }

    if (!selectedUserIds.length) {
      showToast('Select at least one user to assign this achievement.', { variant: 'error' })
      return
    }

    if (isLoadingUserAssignments) {
      showToast('Checking assigned and unassigned users. Please wait a moment.', { variant: 'info' })
      return
    }

    const alreadyAssignedUserIds = selectedUserIds.filter(
      (userId) => userAssignmentStateByUserId[userId]?.status === 'ASSIGNED',
    )
    const userIdsToAssign = selectedUserIds.filter(
      (userId) => userAssignmentStateByUserId[userId]?.status !== 'ASSIGNED',
    )

    if (!userIdsToAssign.length) {
      showToast('All selected users are already assigned to this achievement.', { variant: 'info' })
      return
    }

    const assignAchievement = async () => {
      setIsAssigningAchievement(true)
      const failedUserIds: string[] = []
      const failureMessages: string[] = []
      const successfulAssignments: Array<{ userAchievementId: string | null; userId: string }> = []

      for (const userId of userIdsToAssign) {
        try {
          const response = await achievementService.assignToUser(
            {
              achievementId: selectedAchievement.id,
              userId,
            },
            accessToken,
          )
          successfulAssignments.push({
            userAchievementId: normalizeText(response?.id) || null,
            userId,
          })
        } catch (error) {
          failedUserIds.push(userId)
          const message = getErrorMessage(error)
          if (message.trim()) {
            failureMessages.push(message.trim())
          }
        }
      }

      if (successfulAssignments.length > 0) {
        setUserAssignmentStateByUserId((currentState) => {
          const nextState = { ...currentState }
          successfulAssignments.forEach(({ userAchievementId, userId }) => {
            nextState[userId] = {
              status: 'ASSIGNED',
              userAchievementId: userAchievementId || currentState[userId]?.userAchievementId || null,
            }
          })
          return nextState
        })
      }

      if (!failedUserIds.length) {
        setSelectedUserIds([])
        const skippedSummary = alreadyAssignedUserIds.length
          ? ` ${alreadyAssignedUserIds.length} already assigned and skipped.`
          : ''
        showToast(
          `Assigned ${resolveAchievementTitle(selectedAchievement)} to ${successfulAssignments.length} user${
            successfulAssignments.length === 1 ? '' : 's'
          }.${skippedSummary}`,
          { variant: 'success' },
        )
      } else if (successfulAssignments.length > 0) {
        setSelectedUserIds(failedUserIds)
        const uniqueFailureMessages = Array.from(new Set(failureMessages))
        const failureSummary = uniqueFailureMessages.length
          ? ` API: ${uniqueFailureMessages.slice(0, 2).join(' | ')}`
          : ''
        const skippedSummary = alreadyAssignedUserIds.length
          ? ` ${alreadyAssignedUserIds.length} already assigned and skipped.`
          : ''
        showToast(
          `Assigned ${successfulAssignments.length} user${successfulAssignments.length === 1 ? '' : 's'}. ${
            failedUserIds.length
          } failed and remain selected.${skippedSummary}${failureSummary}`,
          { variant: 'info' },
        )
      } else {
        const uniqueFailureMessages = Array.from(new Set(failureMessages))
        const failureMessage = uniqueFailureMessages[0] || 'Assignment failed for all selected users.'
        showToast(failureMessage, {
          variant: 'error',
        })
      }

      setIsAssigningAchievement(false)
    }

    void assignAchievement()
  }

  const handleUnassignAchievement = () => {
    if (!accessToken) {
      showToast('You need to sign in before unassigning achievements.', { variant: 'error' })
      return
    }

    if (!selectedAchievement) {
      showToast('Select an achievement to continue.', { variant: 'error' })
      return
    }

    if (!selectedUserIds.length) {
      showToast('Select at least one user to unassign this achievement.', { variant: 'error' })
      return
    }

    if (isLoadingUserAssignments) {
      showToast('Checking assigned and unassigned users. Please wait a moment.', { variant: 'info' })
      return
    }

    const unassignAchievement = async () => {
      setIsUnassigningAchievement(true)
      const failedUserIds: string[] = []
      const failureMessages: string[] = []
      const successfullyUnassignedUserIds: string[] = []
      let skippedUnassignedCount = 0

      for (const userId of selectedUserIds) {
        const assignmentState = userAssignmentStateByUserId[userId]

        if (!assignmentState || assignmentState.status === 'UNKNOWN') {
          failedUserIds.push(userId)
          failureMessages.push('Unable to verify assignment status for one or more users.')
          continue
        }

        if (assignmentState.status !== 'ASSIGNED' || !assignmentState.userAchievementId) {
          skippedUnassignedCount += 1
          continue
        }

        try {
          await achievementService.unassignFromUser(assignmentState.userAchievementId, accessToken)
          successfullyUnassignedUserIds.push(userId)
        } catch (error) {
          failedUserIds.push(userId)
          const message = getErrorMessage(error)
          if (message.trim()) {
            failureMessages.push(message.trim())
          }
        }
      }

      if (successfullyUnassignedUserIds.length > 0) {
        setUserAssignmentStateByUserId((currentState) => {
          const nextState = { ...currentState }
          successfullyUnassignedUserIds.forEach((userId) => {
            nextState[userId] = {
              status: 'UNASSIGNED',
              userAchievementId: null,
            }
          })
          return nextState
        })
      }

      if (!failedUserIds.length && successfullyUnassignedUserIds.length > 0) {
        setSelectedUserIds([])
        const skippedSummary = skippedUnassignedCount
          ? ` ${skippedUnassignedCount} already unassigned and skipped.`
          : ''
        showToast(
          `Unassigned ${resolveAchievementTitle(selectedAchievement)} from ${successfullyUnassignedUserIds.length} user${
            successfullyUnassignedUserIds.length === 1 ? '' : 's'
          }.${skippedSummary}`,
          { variant: 'success' },
        )
      } else if (successfullyUnassignedUserIds.length > 0) {
        setSelectedUserIds(failedUserIds)
        const uniqueFailureMessages = Array.from(new Set(failureMessages))
        const failureSummary = uniqueFailureMessages.length
          ? ` API: ${uniqueFailureMessages.slice(0, 2).join(' | ')}`
          : ''
        const skippedSummary = skippedUnassignedCount
          ? ` ${skippedUnassignedCount} already unassigned and skipped.`
          : ''
        showToast(
          `Unassigned ${successfullyUnassignedUserIds.length} user${
            successfullyUnassignedUserIds.length === 1 ? '' : 's'
          }. ${failedUserIds.length} failed and remain selected.${skippedSummary}${failureSummary}`,
          { variant: 'info' },
        )
      } else if (skippedUnassignedCount > 0 && failedUserIds.length === 0) {
        showToast('All selected users are already unassigned for this achievement.', { variant: 'info' })
      } else {
        const uniqueFailureMessages = Array.from(new Set(failureMessages))
        const failureMessage = uniqueFailureMessages[0] || 'Unassignment failed for all selected users.'
        showToast(failureMessage, { variant: 'error' })
      }

      setIsUnassigningAchievement(false)
    }

    void unassignAchievement()
  }

  const handleActionButtonClick = () => {
    if (isAssignMode) {
      handleAssignAchievement()
      return
    }

    handleUnassignAchievement()
  }

  return (
    <MainLayout
      isSidebarOpen={isSidebarOpen}
      onSidebarClose={() => {
        setIsSidebarOpen(false)
      }}
      header={
        <Header
          profile={resolvedHeaderProfile}
          searchValue={headerSearchValue}
          onSearchChange={setHeaderSearchValue}
          isMenuOpen={isSidebarOpen}
          onMenuToggle={() => {
            setIsSidebarOpen((prevState) => !prevState)
          }}
        />
      }
      sidebar={
        <Sidebar
          session={session}
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
            <h1 className={styles.pageTitle}>Achievement Assignment</h1>
          </header>

          <div className={styles.contentGrid}>
            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>1. Select Achievement</h2>
              </div>

              <label className={styles.searchField}>
                <span>Find Achievement</span>
                <input
                  type="search"
                  className={styles.fieldInput}
                  value={achievementSearchValue}
                  placeholder="Search by title, code, category"
                  onChange={(event) => {
                    setAchievementSearchValue(event.target.value)
                  }}
                />
              </label>

              <div className={styles.filterRow}>
                {ASSIGNMENT_FILTER_OPTIONS.map((filterOption) => (
                  <button
                    key={filterOption}
                    type="button"
                    className={`${styles.filterPill} ${
                      assignmentFilter === filterOption ? styles.filterPillActive : ''
                    }`}
                    onClick={() => {
                      setAssignmentFilter(filterOption)
                    }}
                  >
                    {toDisplayText(filterOption)}
                  </button>
                ))}
              </div>

              <div className={styles.achievementList}>
                {isLoadingAchievements ? (
                  <div className={styles.panelState}>Loading achievements...</div>
                ) : filteredAchievements.length === 0 ? (
                  <div className={styles.panelState}>No achievements found.</div>
                ) : (
                  filteredAchievements.map((achievement) => {
                    const isSelected = selectedAchievementId === achievement.id
                    return (
                      <button
                        key={achievement.id}
                        type="button"
                        className={`${styles.achievementCard} ${isSelected ? styles.achievementCardSelected : ''}`}
                        onClick={() => {
                          setSelectedAchievementId(achievement.id)
                        }}
                      >
                        <div className={styles.achievementCardTop}>
                          <div className={styles.achievementIconWrap}>
                            {normalizeText(achievement.iconUrl) ? (
                              <img
                                src={normalizeText(achievement.iconUrl)}
                                alt={resolveAchievementTitle(achievement)}
                                className={styles.achievementIconImage}
                                loading="lazy"
                              />
                            ) : (
                              <FaAward aria-hidden="true" />
                            )}
                          </div>
                          <div className={styles.achievementTextWrap}>
                            <strong className={styles.achievementName}>{resolveAchievementTitle(achievement)}</strong>
                            <span className={styles.achievementCode}>{normalizeText(achievement.code) || 'N/A'}</span>
                          </div>
                        </div>

                        <p className={styles.achievementDescription}>{resolveAchievementDescription(achievement)}</p>

                        <div className={styles.achievementMeta}>
                          <span>{toDisplayText(achievement.assignmentType)}</span>
                          <span>{toDisplayText(achievement.rarity)}</span>
                          <span>{resolveAchievementPoints(achievement)} pts</span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </article>

            <article className={`${styles.panel} ${styles.userPanel}`}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>2. Select Users, Assign, Or Unassign</h2>
                <p className={styles.panelHint}>Filter by assignment status to target assigned or unassigned users.</p>
              </div>

              <label className={styles.searchField}>
                <span>Find User</span>
                <input
                  type="search"
                  className={styles.fieldInput}
                  value={userSearchValue}
                  placeholder="Search by name, email, role, ID"
                  onChange={(event) => {
                    setUserSearchValue(event.target.value)
                  }}
                />
              </label>

              <div className={styles.filterRow}>
                {USER_ASSIGNMENT_FILTER_OPTIONS.map((filterOption) => (
                  <button
                    key={filterOption}
                    type="button"
                    className={`${styles.filterPill} ${
                      userAssignmentFilter === filterOption ? styles.filterPillActive : ''
                    }`}
                    onClick={() => {
                      setUserAssignmentFilter(filterOption)
                    }}
                    disabled={!selectedAchievement}
                  >
                    {toDisplayText(filterOption)}
                  </button>
                ))}
              </div>

              <p className={styles.assignmentStatusHint}>
                {!selectedAchievement
                  ? 'Select an achievement to load assigned and unassigned users.'
                  : isLoadingUserAssignments
                    ? 'Checking user achievement assignments...'
                    : 'Choose Unassigned to assign users, or Assigned to unassign users.'}
              </p>

              <div className={styles.selectionInfoRow}>
                <span className={styles.selectedCount}>
                  <FaUsers aria-hidden="true" />
                  <strong>{selectedUserIds.length}</strong>
                  <span>selected</span>
                </span>
              </div>

              <div className={styles.userTableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col" className={styles.pickColumnHeader}>
                        <button
                          type="button"
                          className={`${styles.checkbox} ${styles.headerCheckbox} ${
                            areAllFilteredUsersSelected ? styles.checkboxSelected : ''
                          } ${
                            hasSomeFilteredUsersSelected && !areAllFilteredUsersSelected ? styles.checkboxPartial : ''
                          }`}
                          onClick={toggleSelectAllFilteredUsers}
                          disabled={!filteredUserRows.length || isLoadingUsers}
                          aria-label={areAllFilteredUsersSelected ? 'Unselect all filtered users' : 'Select all filtered users'}
                          title={areAllFilteredUsersSelected ? 'Unselect filtered users' : 'Select filtered users'}
                        >
                          {areAllFilteredUsersSelected ? (
                            <FaCheck aria-hidden="true" />
                          ) : hasSomeFilteredUsersSelected ? (
                            <span className={styles.checkboxPartialMark} aria-hidden="true" />
                          ) : null}
                        </button>
                      </th>
                      <th scope="col">User</th>
                      <th scope="col">Email</th>
                      <th scope="col">Role</th>
                      <th scope="col">Achievement</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingUsers ? (
                      <tr>
                        <td colSpan={6} className={styles.panelStateCell}>
                          Loading users...
                        </td>
                      </tr>
                    ) : filteredUserRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={styles.panelStateCell}>
                          No users found.
                        </td>
                      </tr>
                    ) : (
                      filteredUserRows.map((row) => {
                        const isSelected = selectedUserIdSet.has(row.id)
                        const assignmentState = userAssignmentStateByUserId[row.id]
                        const assignmentLabel = !selectedAchievement
                          ? 'Select achievement'
                          : !assignmentState || isLoadingUserAssignments
                            ? 'Checking...'
                            : assignmentState.status === 'ASSIGNED'
                              ? 'Assigned'
                              : assignmentState.status === 'UNASSIGNED'
                                ? 'Unassigned'
                                : 'Unavailable'
                        const assignmentClassName =
                          assignmentState?.status === 'ASSIGNED'
                            ? styles.assignmentAssigned
                            : assignmentState?.status === 'UNASSIGNED'
                              ? styles.assignmentUnassigned
                              : styles.assignmentUnknown
                        return (
                          <tr
                            key={row.id}
                            className={isSelected ? styles.selectedUserRow : ''}
                            onClick={() => {
                              toggleUserSelection(row.id)
                            }}
                          >
                            <td className={styles.pickCell}>
                              <span className={`${styles.checkbox} ${isSelected ? styles.checkboxSelected : ''}`}>
                                {isSelected ? <FaCheck aria-hidden="true" /> : null}
                              </span>
                            </td>
                            <td>{row.name}</td>
                            <td>{row.email || 'N/A'}</td>
                            <td>{row.roleLabel}</td>
                            <td>
                              <span className={`${styles.statusPill} ${assignmentClassName}`}>{assignmentLabel}</span>
                            </td>
                            <td>
                              <span className={`${styles.statusPill} ${row.isActive ? styles.statusActive : styles.statusInactive}`}>
                                {row.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className={styles.panelActionRow}>
                <div className={styles.assignmentSummary}>
                  <strong>{selectedAchievement ? resolveAchievementTitle(selectedAchievement) : 'No achievement selected'}</strong>
                  <span>
                    {selectedUserIds.length} user{selectedUserIds.length === 1 ? '' : 's'} selected for{' '}
                    {isAssignMode ? 'assignment' : 'unassignment'}.
                  </span>
                </div>
                <button
                  type="button"
                  className={actionButtonClassName}
                  onClick={handleActionButtonClick}
                  disabled={isActionButtonDisabled}
                >
                  {actionButtonLabel}
                </button>
              </div>

            </article>
          </div>
        </section>
      </div>
    </MainLayout>
  )
}

export default AchievementAssignmentPage



