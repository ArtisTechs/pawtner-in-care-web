import { useCallback, useEffect, useMemo, useState } from 'react'
import { FaCheck, FaClinicMedical, FaUsers } from 'react-icons/fa'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { shelterService } from '@/features/shelters/services/shelter.service'
import type { Shelter } from '@/features/shelters/types/shelter-api'
import { userService } from '@/features/users/services/user.service'
import type { User } from '@/features/users/types/user-api'
import { resolveUserDisplayName, resolveUserRoleLabel } from '@/features/users/utils/user-form'
import { defaultHeaderProfile, sidebarBottomItems, sidebarLogo, sidebarMenuItems } from '@/layouts/config/navigation'
import Header from '@/layouts/Header/Header'
import MainLayout from '@/layouts/MainLayout/MainLayout'
import Sidebar from '@/layouts/Sidebar/Sidebar'
import { getErrorMessage } from '@/shared/api/api-error'
import Toast from '@/shared/components/feedback/Toast'
import ConfirmModal from '@/shared/components/ui/ConfirmModal/ConfirmModal'
import { useHeaderProfile } from '@/shared/hooks/useHeaderProfile'
import { useResponsiveSidebar } from '@/shared/hooks/useResponsiveSidebar'
import { useToast } from '@/shared/hooks/useToast'
import type { SidebarItemKey } from '@/shared/types/layout'
import styles from './ShelterAssociationPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'shelter-association'
const USER_ASSIGNMENT_FILTER_OPTIONS = ['UNASSIGNED', 'ASSIGNED'] as const
type UserAssignmentFilterValue = (typeof USER_ASSIGNMENT_FILTER_OPTIONS)[number]

type UserRow = {
  email: string
  id: string
  isActive: boolean
  name: string
  roleLabel: string
  searchableText: string
  shelterId: string
}

type PendingAssociateAction = {
  shelterName: string
  userIds: string[]
}

const normalizeText = (value?: string | null) => value?.trim() || ''

const alphabeticalCollator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base',
})

const compareAlphabetical = (leftValue: string, rightValue: string) =>
  alphabeticalCollator.compare(leftValue, rightValue)

const sortSheltersAlphabetically = (items: Shelter[]) =>
  [...items].sort((leftShelter, rightShelter) =>
    compareAlphabetical(normalizeText(leftShelter.name), normalizeText(rightShelter.name)),
  )

const sortUserRowsAlphabetically = (items: UserRow[]) =>
  [...items].sort((leftRow, rightRow) => {
    const nameResult = compareAlphabetical(leftRow.name, rightRow.name)
    if (nameResult !== 0) {
      return nameResult
    }

    return compareAlphabetical(leftRow.email, rightRow.email)
  })

const resolveUserIsActive = (user: User) => user.active === true

const readStringField = (value: unknown, keys: string[]) => {
  if (!value || typeof value !== 'object') {
    return ''
  }

  const record = value as Record<string, unknown>
  for (const key of keys) {
    const currentValue = record[key]
    if (typeof currentValue === 'string') {
      const normalizedValue = currentValue.trim()
      if (normalizedValue) {
        return normalizedValue
      }
    }
  }

  return ''
}

const resolveUserShelterId = (user: User) => {
  const directShelterId = normalizeText(user.shelterId)
  if (directShelterId) {
    return directShelterId
  }

  const shelterValue = user.shelter
  if (typeof shelterValue === 'string') {
    return normalizeText(shelterValue)
  }

  return readStringField(shelterValue, ['id', 'shelterId'])
}

const mapUserToRow = (user: User): UserRow => {
  const id = normalizeText(user.id)
  const name = resolveUserDisplayName(user) || normalizeText(user.email) || id || 'Unknown User'
  const email = normalizeText(user.email)
  const roleLabel = resolveUserRoleLabel(user.role)
  const isActive = resolveUserIsActive(user)
  const shelterId = resolveUserShelterId(user)

  return {
    email,
    id,
    isActive,
    name,
    roleLabel,
    searchableText: [name, email, id, roleLabel, shelterId].join(' ').toLowerCase(),
    shelterId,
  }
}

const toDisplayText = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

interface ShelterAssociationPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

function ShelterAssociationPage({ onLogout, session }: ShelterAssociationPageProps) {
  const { clearToast, showToast, toast } = useToast()
  const [headerSearchValue, setHeaderSearchValue] = useState('')
  const [shelterSearchValue, setShelterSearchValue] = useState('')
  const [userSearchValue, setUserSearchValue] = useState('')
  const [userAssignmentFilter, setUserAssignmentFilter] = useState<UserAssignmentFilterValue>('UNASSIGNED')
  const [isLoadingShelters, setIsLoadingShelters] = useState(false)
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [isLoadingAssignedUsers, setIsLoadingAssignedUsers] = useState(false)
  const [isAssociatingUsers, setIsAssociatingUsers] = useState(false)
  const [shelters, setShelters] = useState<Shelter[]>([])
  const [userRows, setUserRows] = useState<UserRow[]>([])
  const [assignedUserRows, setAssignedUserRows] = useState<UserRow[]>([])
  const [selectedShelterId, setSelectedShelterId] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [pendingAssociateAction, setPendingAssociateAction] = useState<PendingAssociateAction | null>(null)
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const resolvedHeaderProfile = useHeaderProfile({
    fallbackProfile: defaultHeaderProfile,
    session,
  })
  const accessToken = session?.accessToken?.trim() ?? ''

  const loadShelters = useCallback(async () => {
    if (!accessToken) {
      setShelters([])
      setSelectedShelterId('')
      return
    }

    setIsLoadingShelters(true)

    try {
      const nextShelters = sortSheltersAlphabetically(await shelterService.list(accessToken))
      setShelters(nextShelters)
      setSelectedShelterId((currentShelterId) => {
        if (currentShelterId && nextShelters.some((shelter) => shelter.id === currentShelterId)) {
          return currentShelterId
        }

        return nextShelters[0]?.id ?? ''
      })
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsLoadingShelters(false)
    }
  }, [accessToken, showToast])

  const loadUsers = useCallback(async () => {
    if (!accessToken) {
      setUserRows([])
      setAssignedUserRows([])
      setSelectedUserIds([])
      return
    }

    setIsLoadingUsers(true)

    try {
      const users = await userService.list(accessToken, {
        page: 0,
        shelterAssignment: 'unassigned',
        size: 500,
        sortBy: 'lastName',
        sortDir: 'asc',
      })
      const nextRows = sortUserRowsAlphabetically(
        users
          .map(mapUserToRow)
          .filter((row) => Boolean(row.id)),
      )
      setUserRows(nextRows)
      setSelectedUserIds((currentUserIds) => currentUserIds.filter((userId) => nextRows.some((row) => row.id === userId)))
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsLoadingUsers(false)
    }
  }, [accessToken, showToast])

  const refreshData = useCallback(async () => {
    await Promise.all([loadShelters(), loadUsers()])
  }, [loadShelters, loadUsers])

  useEffect(() => {
    clearToast()

    if (!accessToken) {
      setShelters([])
      setUserRows([])
      setAssignedUserRows([])
      setSelectedShelterId('')
      setSelectedUserIds([])
      return
    }

    void refreshData()
  }, [accessToken, clearToast, refreshData])

  useEffect(() => {
    setSelectedUserIds([])
  }, [selectedShelterId, userAssignmentFilter])

  const filteredShelters = useMemo(() => {
    const normalizedSearch = shelterSearchValue.trim().toLowerCase()
    if (!normalizedSearch) {
      return shelters
    }

    return shelters.filter((shelter) => {
      const searchableText = [
        normalizeText(shelter.name),
        normalizeText(shelter.id),
      ]
        .join(' ')
        .toLowerCase()

      return searchableText.includes(normalizedSearch)
    })
  }, [shelterSearchValue, shelters])

  const selectedShelter = useMemo(
    () => shelters.find((shelter) => shelter.id === selectedShelterId) ?? null,
    [selectedShelterId, shelters],
  )

  const loadAssignedUsers = useCallback(async () => {
    if (!accessToken || !selectedShelterId) {
      setAssignedUserRows([])
      return
    }

    setIsLoadingAssignedUsers(true)

    try {
      const assignedUsers = await shelterService.listAssignedUsers(selectedShelterId, accessToken)
      const nextRows = sortUserRowsAlphabetically(
        assignedUsers
          .map(mapUserToRow)
          .filter((row) => Boolean(row.id)),
      )
      setAssignedUserRows(nextRows)
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
      setAssignedUserRows([])
    } finally {
      setIsLoadingAssignedUsers(false)
    }
  }, [accessToken, selectedShelterId, showToast])

  useEffect(() => {
    void loadAssignedUsers()
  }, [loadAssignedUsers])

  const filteredUserRows = useMemo(() => {
    const normalizedSearch = userSearchValue.trim().toLowerCase()
    const sourceRows = userAssignmentFilter === 'ASSIGNED' ? assignedUserRows : userRows

    return sourceRows.filter((row) => {
      const matchesSearch = normalizedSearch ? row.searchableText.includes(normalizedSearch) : true
      return matchesSearch
    })
  }, [assignedUserRows, userAssignmentFilter, userRows, userSearchValue])

  const selectedUserIdSet = useMemo(() => new Set(selectedUserIds), [selectedUserIds])

  const areAllFilteredUsersSelected = useMemo(() => {
    if (!filteredUserRows.length) {
      return false
    }

    return filteredUserRows.every((row) => selectedUserIdSet.has(row.id))
  }, [filteredUserRows, selectedUserIdSet])

  const hasSomeFilteredUsersSelected = useMemo(
    () => filteredUserRows.some((row) => selectedUserIdSet.has(row.id)),
    [filteredUserRows, selectedUserIdSet],
  )

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((currentUserIds) => {
      if (currentUserIds.includes(userId)) {
        return currentUserIds.filter((currentUserId) => currentUserId !== userId)
      }

      return [...currentUserIds, userId]
    })
  }

  const toggleSelectAllFilteredUsers = () => {
    if (!filteredUserRows.length) {
      return
    }

    setSelectedUserIds((currentUserIds) => {
      const nextUserIds = new Set(currentUserIds)
      const shouldClearFilteredRows = filteredUserRows.every((row) => nextUserIds.has(row.id))

      filteredUserRows.forEach((row) => {
        if (shouldClearFilteredRows) {
          nextUserIds.delete(row.id)
        } else {
          nextUserIds.add(row.id)
        }
      })

      return Array.from(nextUserIds)
    })
  }

  const isProcessingAction = isAssociatingUsers
  const isAssignMode = userAssignmentFilter === 'UNASSIGNED'
  const isActionButtonDisabled = !selectedShelter || !selectedUserIds.length || isProcessingAction

  const actionButtonLabel = isAssociatingUsers ? 'Associating...' : 'Associate Users'

  const handleAssociateUsers = (requestedUserIds?: string[]) => {
    if (!accessToken) {
      showToast('You need to sign in before associating users to shelters.', { variant: 'error' })
      return
    }

    if (!selectedShelter) {
      showToast('Select a shelter to continue.', { variant: 'error' })
      return
    }

    const targetUserIds = requestedUserIds ?? selectedUserIds

    if (!targetUserIds.length) {
      showToast('Select at least one user to associate.', { variant: 'error' })
      return
    }

    const usersAlreadyAssociated = targetUserIds.filter((userId) => {
      const userRow = userRows.find((row) => row.id === userId)
      return userRow?.shelterId === selectedShelter.id
    })

    const userIdsToAssociate = targetUserIds.filter((userId) => !usersAlreadyAssociated.includes(userId))
    if (!userIdsToAssociate.length) {
      showToast('All selected users are already associated to this shelter.', { variant: 'info' })
      return
    }

    const associateUsers = async () => {
      setIsAssociatingUsers(true)

      const successfulUserIds: string[] = []
      const failedUserIds: string[] = []
      const failureMessages: string[] = []
      try {
        for (const userId of userIdsToAssociate) {
          try {
            await shelterService.associateUserToShelter(
              {
                userId,
                shelterId: selectedShelter.id,
              },
              accessToken,
            )
            successfulUserIds.push(userId)
          } catch (error) {
            failedUserIds.push(userId)
            const message = getErrorMessage(error)
            if (message.trim()) {
              failureMessages.push(message.trim())
            }
          }
        }

        if (successfulUserIds.length > 0 || failedUserIds.length > 0) {
          await Promise.all([loadUsers(), loadAssignedUsers()])
        }

        if (!failedUserIds.length) {
          setSelectedUserIds([])
          const skippedSummary = usersAlreadyAssociated.length
            ? ` ${usersAlreadyAssociated.length} already associated and skipped.`
            : ''
          showToast(
            `Associated ${successfulUserIds.length} user${successfulUserIds.length === 1 ? '' : 's'} to ${
              normalizeText(selectedShelter.name) || 'selected shelter'
            }.${skippedSummary}`,
            { variant: 'success' },
          )
        } else if (successfulUserIds.length > 0) {
          setSelectedUserIds(failedUserIds)
          const uniqueFailureMessages = Array.from(new Set(failureMessages))
          const failureSummary = uniqueFailureMessages.length
            ? ` API: ${uniqueFailureMessages.slice(0, 2).join(' | ')}`
            : ''
          showToast(
            `Associated ${successfulUserIds.length} user${successfulUserIds.length === 1 ? '' : 's'}. ${
              failedUserIds.length
            } failed and remain selected.${failureSummary}`,
            { variant: 'info' },
          )
        } else {
          const uniqueFailureMessages = Array.from(new Set(failureMessages))
          showToast(uniqueFailureMessages[0] || 'Association failed for all selected users.', { variant: 'error' })
        }
      } finally {
        setIsAssociatingUsers(false)
        setPendingAssociateAction(null)
      }
    }

    void associateUsers()
  }

  const handleActionButtonClick = () => {
    if (!isAssignMode) {
      return
    }

    if (!selectedShelter || !selectedUserIds.length || isProcessingAction) {
      return
    }

    setPendingAssociateAction({
      shelterName: normalizeText(selectedShelter.name) || 'selected shelter',
      userIds: [...selectedUserIds],
    })
  }

  return (
    <>
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
            <h1 className={styles.pageTitle}>Shelter Association</h1>
          </header>

          <div className={styles.contentGrid}>
            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>1. Select Shelter</h2>
              </div>

              <label className={styles.searchField}>
                <span>Find Shelter</span>
                <input
                  type="search"
                  className={styles.fieldInput}
                  value={shelterSearchValue}
                  placeholder="Search by shelter name"
                  onChange={(event) => {
                    setShelterSearchValue(event.target.value)
                  }}
                />
              </label>

              <div className={styles.achievementList}>
                {isLoadingShelters ? (
                  <div className={styles.panelState}>Loading shelters...</div>
                ) : filteredShelters.length === 0 ? (
                  <div className={styles.panelState}>No shelters found.</div>
                ) : (
                  filteredShelters.map((shelter) => {
                    const isSelected = selectedShelterId === shelter.id
                    return (
                      <button
                        key={shelter.id}
                        type="button"
                        className={`${styles.achievementCard} ${isSelected ? styles.achievementCardSelected : ''}`}
                        onClick={() => {
                          setSelectedShelterId(shelter.id)
                        }}
                      >
                        <div className={styles.achievementCardTop}>
                          <div className={styles.achievementIconWrap}>
                            <FaClinicMedical aria-hidden="true" />
                          </div>
                          <div className={styles.achievementTextWrap}>
                            <div className={styles.achievementNameRow}>
                              <strong className={styles.achievementName}>{normalizeText(shelter.name) || 'Unnamed Shelter'}</strong>
                              <span className={styles.achievementStatusPill}>{shelter.active === true ? 'Active' : 'Inactive'}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </article>

            <article className={`${styles.panel} ${styles.userPanel}`}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>2. Select Users By Assignment Status</h2>
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
                    disabled={!selectedShelter}
                  >
                    {toDisplayText(filterOption)}
                  </button>
                ))}
              </div>

              <p className={styles.assignmentStatusHint}>
                {!selectedShelter
                  ? 'Select a shelter to load assigned and unassigned users.'
                  : userAssignmentFilter === 'ASSIGNED'
                    ? 'Assigned users are display-only in this view.'
                    : 'Choose unassigned users and click Associate Users to assign them to the selected shelter.'}
              </p>

              {isAssignMode ? (
                <div className={styles.selectionInfoRow}>
                  <span className={styles.selectedCount}>
                    <FaUsers aria-hidden="true" />
                    <strong>{selectedUserIds.length}</strong>
                    <span>selected</span>
                  </span>
                </div>
              ) : null}

              <div className={styles.userTableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {isAssignMode ? (
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
                      ) : null}
                      <th scope="col">User</th>
                      <th scope="col">Email</th>
                      <th scope="col">Role</th>
                      <th scope="col">Shelter Link</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingUsers || (userAssignmentFilter === 'ASSIGNED' && isLoadingAssignedUsers) ? (
                      <tr>
                        <td colSpan={isAssignMode ? 6 : 5} className={styles.panelStateCell}>
                          {userAssignmentFilter === 'ASSIGNED' ? 'Loading assigned users...' : 'Loading users...'}
                        </td>
                      </tr>
                    ) : filteredUserRows.length === 0 ? (
                      <tr>
                        <td colSpan={isAssignMode ? 6 : 5} className={styles.panelStateCell}>
                          No users found.
                        </td>
                      </tr>
                    ) : (
                      filteredUserRows.map((row) => {
                        const isSelected = selectedUserIdSet.has(row.id)
                        const assignmentLabel = userAssignmentFilter === 'ASSIGNED' ? 'Assigned' : 'Unassigned'
                        const assignmentClassName =
                          userAssignmentFilter === 'ASSIGNED' ? styles.assignmentAssigned : styles.assignmentUnassigned

                        return (
                          <tr
                            key={row.id}
                            className={`${isAssignMode && isSelected ? styles.selectedUserRow : ''} ${
                              !isAssignMode ? styles.readOnlyRow : ''
                            }`}
                            onClick={() => {
                              if (!isAssignMode) {
                                return
                              }

                              toggleUserSelection(row.id)
                            }}
                          >
                            {isAssignMode ? (
                              <td className={styles.pickCell}>
                                <span className={`${styles.checkbox} ${isSelected ? styles.checkboxSelected : ''}`}>
                                  {isSelected ? <FaCheck aria-hidden="true" /> : null}
                                </span>
                              </td>
                            ) : null}
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

              {isAssignMode ? (
                <div className={styles.panelActionRow}>
                  <div className={styles.assignmentSummary}>
                    <strong>{selectedShelter ? normalizeText(selectedShelter.name) || 'Selected Shelter' : 'No shelter selected'}</strong>
                    <span>
                      {selectedUserIds.length} user{selectedUserIds.length === 1 ? '' : 's'} selected for association.
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.assignButton}
                    onClick={handleActionButtonClick}
                    disabled={isActionButtonDisabled}
                  >
                    {actionButtonLabel}
                  </button>
                </div>
              ) : null}
            </article>
          </div>
        </section>
      </div>
      </MainLayout>
      <ConfirmModal
        isOpen={Boolean(pendingAssociateAction)}
        title="Associate selected users?"
        message={`Associate ${pendingAssociateAction?.userIds.length ?? 0} selected user${
          (pendingAssociateAction?.userIds.length ?? 0) === 1 ? '' : 's'
        } to ${pendingAssociateAction?.shelterName ?? 'selected shelter'}?`}
        confirmLabel="Associate"
        confirmTone="success"
        cancelLabel="Cancel"
        ariaLabel="Associate users confirmation"
        isBusy={isAssociatingUsers}
        onCancel={() => {
          if (isAssociatingUsers) {
            return
          }

          setPendingAssociateAction(null)
        }}
        onConfirm={() => {
          if (!pendingAssociateAction) {
            return
          }

          handleAssociateUsers(pendingAssociateAction.userIds)
        }}
      />
    </>
  )
}

export default ShelterAssociationPage
