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
type AssignmentFilterValue = (typeof ASSIGNMENT_FILTER_OPTIONS)[number]

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
  const [isLoadingAchievements, setIsLoadingAchievements] = useState(false)
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [isAssigningAchievement, setIsAssigningAchievement] = useState(false)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [userRows, setUserRows] = useState<UserRow[]>([])
  const [selectedAchievementId, setSelectedAchievementId] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
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
      const nextAchievements = result.items.filter((achievement) => achievement.isActive !== false)
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
      setUserRows(nextRows)
      setSelectedUserIds((currentIds) => currentIds.filter((id) => nextRows.some((row) => row.id === id)))
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
      return
    }

    void refreshData()
  }, [accessToken, clearToast, refreshData])

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

  const filteredUserRows = useMemo(() => {
    const normalizedSearch = userSearchValue.trim().toLowerCase()
    if (!normalizedSearch) {
      return userRows
    }

    return userRows.filter((row) => row.searchableText.includes(normalizedSearch))
  }, [userRows, userSearchValue])

  const selectedUserIdSet = useMemo(() => new Set(selectedUserIds), [selectedUserIds])

  const areAllFilteredUsersSelected = useMemo(() => {
    if (filteredUserRows.length === 0) {
      return false
    }

    return filteredUserRows.every((row) => selectedUserIdSet.has(row.id))
  }, [filteredUserRows, selectedUserIdSet])

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

  const clearAllSelectedUsers = () => {
    setSelectedUserIds([])
  }

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

    const assignAchievement = async () => {
      setIsAssigningAchievement(true)
      const failedUserIds: string[] = []
      const failureMessages: string[] = []
      let successCount = 0

      for (const userId of selectedUserIds) {
        try {
          await achievementService.assignToUser(
            {
              achievementId: selectedAchievement.id,
              userId,
            },
            accessToken,
          )
          successCount += 1
        } catch (error) {
          failedUserIds.push(userId)
          const message = getErrorMessage(error)
          if (message.trim()) {
            failureMessages.push(message.trim())
          }
        }
      }

      if (!failedUserIds.length) {
        setSelectedUserIds([])
        showToast(
          `Assigned ${resolveAchievementTitle(selectedAchievement)} to ${successCount} user${successCount === 1 ? '' : 's'}.`,
          { variant: 'success' },
        )
      } else if (successCount > 0) {
        setSelectedUserIds(failedUserIds)
        const uniqueFailureMessages = Array.from(new Set(failureMessages))
        const failureSummary = uniqueFailureMessages.length
          ? ` API: ${uniqueFailureMessages.slice(0, 2).join(' | ')}`
          : ''
        showToast(
          `Assigned ${successCount} user${successCount === 1 ? '' : 's'}. ${failedUserIds.length} failed and remain selected.${failureSummary}`,
          { variant: 'info' },
        )
      } else {
        const uniqueFailureMessages = Array.from(new Set(failureMessages))
        const failureMessage = uniqueFailureMessages[0] || 'Assignment failed for all selected users.'
        showToast(`${failureMessage}`, {
          variant: 'error',
        })
      }

      setIsAssigningAchievement(false)
    }

    void assignAchievement()
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
                <h2 className={styles.panelTitle}>2. Select Users And Assign</h2>
                <p className={styles.panelHint}>Search and select one or more users.</p>
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

              <div className={styles.userActionRow}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={toggleSelectAllFilteredUsers}
                  disabled={!filteredUserRows.length || isLoadingUsers}
                >
                  {areAllFilteredUsersSelected ? 'Unselect Filtered' : 'Select Filtered'}
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={clearAllSelectedUsers}
                  disabled={!selectedUserIds.length}
                >
                  Clear Selected
                </button>
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
                      <th scope="col">Pick</th>
                      <th scope="col">User</th>
                      <th scope="col">Email</th>
                      <th scope="col">Role</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingUsers ? (
                      <tr>
                        <td colSpan={5} className={styles.panelStateCell}>
                          Loading users...
                        </td>
                      </tr>
                    ) : filteredUserRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className={styles.panelStateCell}>
                          No users found.
                        </td>
                      </tr>
                    ) : (
                      filteredUserRows.map((row) => {
                        const isSelected = selectedUserIdSet.has(row.id)
                        return (
                          <tr
                            key={row.id}
                            className={isSelected ? styles.selectedUserRow : ''}
                            onClick={() => {
                              toggleUserSelection(row.id)
                            }}
                          >
                            <td>
                              <span className={`${styles.checkbox} ${isSelected ? styles.checkboxSelected : ''}`}>
                                {isSelected ? <FaCheck aria-hidden="true" /> : null}
                              </span>
                            </td>
                            <td>{row.name}</td>
                            <td>{row.email || 'N/A'}</td>
                            <td>{row.roleLabel}</td>
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
                    {selectedUserIds.length} user{selectedUserIds.length === 1 ? '' : 's'} ready for assignment
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.assignButton}
                  onClick={handleAssignAchievement}
                  disabled={!selectedAchievement || !selectedUserIds.length || isAssigningAchievement}
                >
                  {isAssigningAchievement ? 'Assigning...' : 'Assign Achievement'}
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
