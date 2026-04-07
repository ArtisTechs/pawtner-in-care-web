import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { FaEdit, FaTimes, FaUserCircle } from 'react-icons/fa'
import type { AuthSession } from '@/features/auth/types/auth-api'
import {
  DEFAULT_ADD_USER_FORM,
  DEFAULT_LIST_PAGE,
  DEFAULT_LIST_SIZE,
  DEFAULT_LIST_SORT_BY,
  DEFAULT_LIST_SORT_DIR,
  LIST_BATCH_SIZE,
  LIST_INITIAL_BATCH_SIZE,
  LIST_SKELETON_ROW_COUNT,
  USER_ROLE_OPTIONS,
  type AddUserForm,
} from '@/features/users/constants/user-list.constants'
import { userService } from '@/features/users/services/user.service'
import type { User, UserRole } from '@/features/users/types/user-api'
import {
  buildUserPayload,
  resolveUserDisplayName,
  mapUserToForm,
  resolveUserFullName,
  resolveUserRoleLabel,
  resolveUserRoleValue,
} from '@/features/users/utils/user-form'
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
import { isValidEmail } from '@/shared/lib/validation/contact'
import type { SidebarItemKey } from '@/shared/types/layout'
import styles from './UserListPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'user-list'

const formatDateLabel = (value?: string | null) => {
  if (!value) {
    return 'N/A'
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return 'N/A'
  }

  return parsedDate.toLocaleDateString('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const resolveRoleBadgeClassName = (role: User['role']) =>
  resolveUserRoleValue(role) === 'ADMIN' ? styles.roleAdmin : styles.roleUser

const resolveUserActiveValue = (user: User) => {
  if (typeof user.active === 'boolean') {
    return user.active
  }

  return resolveUserRoleValue(user.role) === 'USER'
}

const resolveActiveBadgeClassName = (user: User) =>
  resolveUserActiveValue(user) ? styles.statusActive : styles.statusInactive

const resolveActiveLabel = (user: User) => (resolveUserActiveValue(user) ? 'Active' : 'Inactive')

interface UserAvatarProps {
  className: string
  fallbackClassName: string
  iconClassName: string
  user: User
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const getStringField = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string') {
      const trimmedValue = value.trim()
      if (trimmedValue) {
        return trimmedValue
      }
    }
  }

  return ''
}

const resolveSessionIdentity = (user: AuthSession['user']) => {
  if (!isRecord(user)) {
    return { email: '', id: '' }
  }

  const rootId = getStringField(user, ['id', 'userId'])
  const rootEmail = getStringField(user, ['email']).toLowerCase()

  if (rootId || rootEmail) {
    return { email: rootEmail, id: rootId }
  }

  const nestedUser = user.user
  if (!isRecord(nestedUser)) {
    return { email: '', id: '' }
  }

  return {
    email: getStringField(nestedUser, ['email']).toLowerCase(),
    id: getStringField(nestedUser, ['id', 'userId']),
  }
}

function UserAvatar({ className, fallbackClassName, iconClassName, user }: UserAvatarProps) {
  const profilePicture = user.profilePicture?.trim() ?? ''
  const [hasImageError, setHasImageError] = useState(false)

  useEffect(() => {
    setHasImageError(false)
  }, [profilePicture])

  if (!profilePicture || hasImageError) {
    return (
      <span className={fallbackClassName} aria-hidden="true">
        <FaUserCircle className={iconClassName} />
      </span>
    )
  }

  return (
    <img
      src={profilePicture}
      alt={resolveUserFullName(user)}
      className={className}
      onError={() => {
        setHasImageError(true)
      }}
    />
  )
}

interface UserListPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

function UserListPage({ onLogout, session }: UserListPageProps) {
  const { clearToast, showToast, toast } = useToast()
  const [searchValue, setSearchValue] = useState('')
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const resolvedHeaderProfile = useHeaderProfile({
    fallbackProfile: defaultHeaderProfile,
    session,
  })
  const [users, setUsers] = useState<User[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [viewingUser, setViewingUser] = useState<User | null>(null)
  const [isRefreshingViewingUser, setIsRefreshingViewingUser] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [isSavingUser, setIsSavingUser] = useState(false)
  const [pendingToggleUser, setPendingToggleUser] = useState<{
    id: string
    name: string
    nextActive: boolean
  } | null>(null)
  const [userIdBeingToggled, setUserIdBeingToggled] = useState<string | null>(null)
  const [addUserForm, setAddUserForm] = useState<AddUserForm>(DEFAULT_ADD_USER_FORM)
  const [visibleUserCount, setVisibleUserCount] = useState(LIST_INITIAL_BATCH_SIZE)
  const tableScrollRef = useRef<HTMLDivElement | null>(null)
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null)
  const latestListRequestIdRef = useRef(0)
  const latestViewRequestIdRef = useRef(0)
  const accessToken = session?.accessToken?.trim() ?? ''
  const sessionIdentity = useMemo(() => resolveSessionIdentity(session?.user), [session?.user])

  const loadUsers = useCallback(
    async (searchTerm: string) => {
      if (!accessToken) {
        setUsers([])
        setIsLoadingUsers(false)
        return
      }

      const requestId = latestListRequestIdRef.current + 1
      latestListRequestIdRef.current = requestId
      setIsLoadingUsers(true)

      try {
        const userList = await userService.list(accessToken, {
          page: DEFAULT_LIST_PAGE,
          search: searchTerm.trim() || undefined,
          size: DEFAULT_LIST_SIZE,
          sortBy: DEFAULT_LIST_SORT_BY,
          sortDir: DEFAULT_LIST_SORT_DIR,
        })

        if (requestId !== latestListRequestIdRef.current) {
          return
        }

        const resolvedUsers = Array.isArray(userList) ? userList : []
        const nextUsers = resolvedUsers.filter((userItem) => {
          const userId = userItem.id?.trim() ?? ''
          if (sessionIdentity.id && userId && userId === sessionIdentity.id) {
            return false
          }

          const userEmail = userItem.email?.trim().toLowerCase() ?? ''
          if (sessionIdentity.email && userEmail && userEmail === sessionIdentity.email) {
            return false
          }

          return true
        })

        setUsers(nextUsers)
      } catch (error) {
        if (requestId !== latestListRequestIdRef.current) {
          return
        }

        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        if (requestId === latestListRequestIdRef.current) {
          setIsLoadingUsers(false)
        }
      }
    },
    [accessToken, sessionIdentity.email, sessionIdentity.id, showToast],
  )

  useEffect(() => {
    clearToast()
  }, [clearToast])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadUsers(searchValue)
    }, 300)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loadUsers, searchValue])

  useEffect(() => {
    setVisibleUserCount(LIST_INITIAL_BATCH_SIZE)
  }, [users])

  const visibleUsers = useMemo(() => users.slice(0, visibleUserCount), [users, visibleUserCount])
  const hasMoreUsersToReveal = visibleUsers.length < users.length
  const skeletonRowIndexes = useMemo(
    () => Array.from({ length: LIST_SKELETON_ROW_COUNT }, (_, index) => index),
    [],
  )

  useEffect(() => {
    const scrollContainer = tableScrollRef.current
    const triggerElement = loadMoreTriggerRef.current
    if (!scrollContainer || !triggerElement || isLoadingUsers || !hasMoreUsersToReveal) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (!entry?.isIntersecting) {
          return
        }

        setVisibleUserCount((currentCount) => Math.min(currentCount + LIST_BATCH_SIZE, users.length))
      },
      {
        root: scrollContainer,
        rootMargin: '120px 0px',
        threshold: 0.05,
      },
    )

    observer.observe(triggerElement)

    return () => {
      observer.disconnect()
    }
  }, [hasMoreUsersToReveal, isLoadingUsers, users.length])

  const closeAddModal = useCallback(() => {
    setIsAddModalOpen(false)
    setEditingUserId(null)
    setAddUserForm(DEFAULT_ADD_USER_FORM)
  }, [])

  const closeViewModal = useCallback(() => {
    latestViewRequestIdRef.current += 1
    setIsRefreshingViewingUser(false)
    setViewingUser(null)
  }, [])

  const handleAddUserSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!accessToken) {
      showToast('You need to sign in before managing users.', { variant: 'error' })
      return
    }

    const persistUser = async () => {
      const trimmedFirstName = addUserForm.firstName.trim()
      const trimmedLastName = addUserForm.lastName.trim()
      const trimmedEmail = addUserForm.email.trim()
      const trimmedPassword = addUserForm.password.trim()

      if (!trimmedFirstName || !trimmedLastName || !trimmedEmail) {
        showToast('Please complete all required fields.', { variant: 'error' })
        return
      }

      if (!editingUserId && !trimmedPassword) {
        showToast('Please complete all required fields.', { variant: 'error' })
        return
      }

      if (!isValidEmail(trimmedEmail)) {
        showToast('Email address must be a valid email.', { variant: 'error' })
        return
      }

      setIsSavingUser(true)
      const payload = buildUserPayload(addUserForm, Boolean(editingUserId))

      try {
        if (editingUserId) {
          await userService.update(editingUserId, payload, accessToken)
          showToast('User updated successfully.', { variant: 'success' })
        } else {
          await userService.create(payload, accessToken)
          showToast('User added successfully.', { variant: 'success' })
        }

        closeAddModal()
        await loadUsers(searchValue)
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setIsSavingUser(false)
      }
    }

    void persistUser()
  }

  const handleEditUser = (user: User) => {
    setEditingUserId(user.id)
    setAddUserForm(mapUserToForm(user))
    setIsAddModalOpen(true)
  }

  const handleViewUser = (user: User) => {
    setViewingUser(user)

    if (!accessToken) {
      return
    }

    const requestId = latestViewRequestIdRef.current + 1
    latestViewRequestIdRef.current = requestId
    setIsRefreshingViewingUser(true)

    const hydrateViewedUser = async () => {
      try {
        const fullUser = await userService.getOne(user.id, accessToken)
        if (requestId !== latestViewRequestIdRef.current) {
          return
        }

        setViewingUser(fullUser)
      } catch (error) {
        if (requestId !== latestViewRequestIdRef.current) {
          return
        }

        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        if (requestId === latestViewRequestIdRef.current) {
          setIsRefreshingViewingUser(false)
        }
      }
    }

    void hydrateViewedUser()
  }

  const handleViewEdit = () => {
    if (!viewingUser) {
      return
    }

    const nextUserToEdit = viewingUser
    closeViewModal()
    handleEditUser(nextUserToEdit)
  }

  const handleToggleUserActive = (userId: string, nextActive: boolean) => {
    if (!accessToken) {
      setPendingToggleUser(null)
      showToast('You need to sign in before managing users.', { variant: 'error' })
      return
    }

    const toggleUserActive = async () => {
      setUserIdBeingToggled(userId)

      try {
        const updatedUser = await userService.toggleActive(
          userId,
          nextActive,
          accessToken,
          sessionIdentity.id || undefined,
        )
        const resolvedActiveValue =
          typeof updatedUser.active === 'boolean' ? updatedUser.active : nextActive

        setUsers((currentUsers) =>
          currentUsers.map((userItem) =>
            userItem.id === userId
              ? {
                  ...userItem,
                  ...updatedUser,
                  active: resolvedActiveValue,
                }
              : userItem,
          ),
        )
        setViewingUser((currentUser) =>
          currentUser?.id === userId
            ? {
                ...currentUser,
                ...updatedUser,
                active: resolvedActiveValue,
              }
            : currentUser,
        )
        showToast(`User ${resolvedActiveValue ? 'enabled' : 'disabled'} successfully.`, {
          variant: 'success',
        })
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setPendingToggleUser(null)
        setUserIdBeingToggled(null)
      }
    }

    void toggleUserActive()
  }

  const handleToggleUserRequest = (user: User) => {
    const currentActiveValue = resolveUserActiveValue(user)
    setPendingToggleUser({
      id: user.id,
      name: resolveUserFullName(user),
      nextActive: !currentActiveValue,
    })
  }

  const handleToggleUserConfirm = () => {
    if (!pendingToggleUser) {
      return
    }

    handleToggleUserActive(pendingToggleUser.id, pendingToggleUser.nextActive)
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
          <h1 className={styles.pageTitle}>User List</h1>

          <div className={styles.tablePanel}>
            <div className={styles.tableScroll} ref={tableScrollRef}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Image</th>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Role</th>
                    <th scope="col">Status</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {isLoadingUsers ? (
                    skeletonRowIndexes.map((rowIndex) => (
                      <tr key={`user-skeleton-${rowIndex}`} aria-hidden="true">
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonImage}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonText}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonTextWide}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonBadge}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonBadge}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonAction}`} />
                        </td>
                      </tr>
                    ))
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={styles.tableStateCell}>
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    visibleUsers.map((user) => (
                      <tr
                        key={user.id}
                        className={styles.clickableRow}
                        onClick={() => {
                          handleViewUser(user)
                        }}
                      >
                        <td>
                          <UserAvatar
                            user={user}
                            className={styles.userImage}
                            fallbackClassName={styles.userImageFallback}
                            iconClassName={styles.userImageFallbackIcon}
                          />
                        </td>
                        <td>{resolveUserDisplayName(user) || 'N/A'}</td>
                        <td>{user.email?.trim() || 'N/A'}</td>
                        <td>
                          <span
                            className={`${styles.roleBadge} ${resolveRoleBadgeClassName(user.role)}`}
                          >
                            {resolveUserRoleLabel(user.role)}
                          </span>
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${resolveActiveBadgeClassName(user)}`}>
                            {resolveActiveLabel(user)}
                          </span>
                        </td>
                        <td>
                          <div className={styles.actionCell}>
                            <button
                              type="button"
                              className={styles.actionButton}
                              aria-label={`Edit ${resolveUserFullName(user)}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleEditUser(user)
                              }}
                            >
                              <FaEdit aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className={`${styles.actionButton} ${styles.toggleActionButton} ${
                                resolveUserActiveValue(user) ? styles.disableActionButton : styles.enableActionButton
                              }`}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleToggleUserRequest(user)
                              }}
                              disabled={userIdBeingToggled === user.id}
                            >
                              {resolveUserActiveValue(user) ? 'Disable' : 'Enable'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {hasMoreUsersToReveal ? <div ref={loadMoreTriggerRef} className={styles.loadMoreTrigger} /> : null}
            </div>

          </div>

          <footer className={styles.tableFooter}>
            <span className={styles.footerText}>
              Showing {visibleUsers.length} of {users.length}
            </span>
          </footer>
        </section>
      </div>

      {viewingUser ? (
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
            aria-labelledby="view-user-modal-title"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className={styles.modalHeader}>
              <h2 id="view-user-modal-title" className={styles.modalTitle}>
                User Details
              </h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => {
                  closeViewModal()
                }}
                aria-label="Close user details modal"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className={styles.viewModalBody}>
              <div className={styles.viewMedia}>
                <UserAvatar
                  user={viewingUser}
                  className={styles.viewImage}
                  fallbackClassName={styles.viewImageFallback}
                  iconClassName={styles.viewImageFallbackIcon}
                />
                {isRefreshingViewingUser ? (
                  <span className={styles.viewLoadingText}>Refreshing user details...</span>
                ) : null}
              </div>

              <div className={styles.viewDetailsGrid}>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Name</span>
                  <span className={styles.viewDetailValue}>{resolveUserDisplayName(viewingUser) || 'N/A'}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Email</span>
                  <span className={styles.viewDetailValue}>{viewingUser.email?.trim() || 'N/A'}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Role</span>
                  <span className={styles.viewDetailValue}>{resolveUserRoleLabel(viewingUser.role)}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Status</span>
                  <span className={styles.viewDetailValue}>{resolveActiveLabel(viewingUser)}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Created Date</span>
                  <span className={styles.viewDetailValue}>
                    {formatDateLabel(viewingUser.createdDate ?? viewingUser.createdAt)}
                  </span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Updated Date</span>
                  <span className={styles.viewDetailValue}>
                    {formatDateLabel(viewingUser.updatedDate ?? viewingUser.updatedAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className={`${styles.modalActions} ${styles.viewModalActions}`}>
              <button
                type="button"
                className={styles.modalSubmitButton}
                onClick={() => {
                  handleViewEdit()
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className={`${styles.modalSubmitButton} ${styles.viewToggleButton} ${
                  resolveUserActiveValue(viewingUser) ? styles.viewDisableButton : styles.viewEnableButton
                }`}
                onClick={() => {
                  handleToggleUserRequest(viewingUser)
                }}
                disabled={userIdBeingToggled === viewingUser.id}
              >
                {resolveUserActiveValue(viewingUser) ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isAddModalOpen ? (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            closeAddModal()
          }}
        >
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-user-modal-title"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className={styles.modalHeader}>
              <h2 id="add-user-modal-title" className={styles.modalTitle}>
                {editingUserId ? 'Edit User' : 'Add User'}
              </h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => {
                  closeAddModal()
                }}
                aria-label="Close add user modal"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={handleAddUserSubmit} noValidate>
              <div className={styles.modalFields}>
                <label className={styles.fieldLabel}>
                  <span>First Name</span>
                  <input
                    type="text"
                    value={addUserForm.firstName}
                    onChange={(event) => {
                      setAddUserForm((currentForm) => ({
                        ...currentForm,
                        firstName: event.target.value,
                      }))
                    }}
                    className={styles.fieldInput}
                  />
                </label>

                <label className={styles.fieldLabel}>
                  <span>Middle Name</span>
                  <input
                    type="text"
                    value={addUserForm.middleName}
                    onChange={(event) => {
                      setAddUserForm((currentForm) => ({
                        ...currentForm,
                        middleName: event.target.value,
                      }))
                    }}
                    className={styles.fieldInput}
                  />
                </label>

                <label className={styles.fieldLabel}>
                  <span>Last Name</span>
                  <input
                    type="text"
                    value={addUserForm.lastName}
                    onChange={(event) => {
                      setAddUserForm((currentForm) => ({
                        ...currentForm,
                        lastName: event.target.value,
                      }))
                    }}
                    className={styles.fieldInput}
                  />
                </label>

                <label className={styles.fieldLabel}>
                  <span>Email</span>
                  <input
                    type="email"
                    value={addUserForm.email}
                    onChange={(event) => {
                      setAddUserForm((currentForm) => ({
                        ...currentForm,
                        email: event.target.value,
                      }))
                    }}
                    className={styles.fieldInput}
                    readOnly={Boolean(editingUserId)}
                    disabled={Boolean(editingUserId)}
                  />
                </label>

                {!editingUserId ? (
                  <label className={styles.fieldLabel}>
                    <span>Password</span>
                    <input
                      type="password"
                      value={addUserForm.password}
                      onChange={(event) => {
                        setAddUserForm((currentForm) => ({
                          ...currentForm,
                          password: event.target.value,
                        }))
                      }}
                      className={styles.fieldInput}
                      placeholder="Enter password"
                    />
                  </label>
                ) : null}

                <label className={styles.fieldLabel}>
                  <span>Role</span>
                  <select
                    value={resolveUserRoleValue(addUserForm.role)}
                    onChange={(event) => {
                      setAddUserForm((currentForm) => ({
                        ...currentForm,
                        role: event.target.value as UserRole,
                      }))
                    }}
                    className={styles.fieldInput}
                  >
                    {USER_ROLE_OPTIONS.map((roleOption) => (
                      <option key={roleOption} value={roleOption}>
                        {resolveUserRoleLabel(roleOption)}
                      </option>
                    ))}
                  </select>
                </label>

                {!editingUserId ? (
                  <label className={`${styles.fieldLabel} ${styles.fieldLabelWide}`}>
                    <span>Profile Picture URL</span>
                    <input
                      type="url"
                      value={addUserForm.profilePicture}
                      onChange={(event) => {
                        setAddUserForm((currentForm) => ({
                          ...currentForm,
                          profilePicture: event.target.value,
                        }))
                      }}
                      className={styles.fieldInput}
                      placeholder="https://example.com/profiles/user.jpg"
                    />
                  </label>
                ) : null}
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.modalCancelButton}
                  onClick={() => {
                    closeAddModal()
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.modalSubmitButton} disabled={isSavingUser}>
                  {isSavingUser ? 'Saving...' : editingUserId ? 'Save' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={Boolean(pendingToggleUser)}
        title={`${pendingToggleUser?.nextActive ? 'Enable' : 'Disable'} user?`}
        message={`Are you sure you want to ${pendingToggleUser?.nextActive ? 'enable' : 'disable'} ${
          pendingToggleUser?.name ?? 'this user'
        }?`}
        confirmLabel={pendingToggleUser?.nextActive ? 'Enable' : 'Disable'}
        confirmTone={pendingToggleUser?.nextActive ? 'success' : 'danger'}
        cancelLabel="Cancel"
        ariaLabel={`${pendingToggleUser?.nextActive ? 'Enable' : 'Disable'} user confirmation`}
        isBusy={userIdBeingToggled !== null}
        onCancel={() => {
          setPendingToggleUser(null)
        }}
        onConfirm={handleToggleUserConfirm}
      />
    </MainLayout>
  )
}

export default UserListPage
