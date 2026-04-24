import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { FaEdit, FaPlus, FaTimes } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'
import { APP_ROUTES } from '@/app/routes/route-paths'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { shelterService } from '@/features/shelters/services/shelter.service'
import type { Shelter } from '@/features/shelters/types/shelter-api'
import { defaultHeaderProfile, sidebarBottomItems, sidebarLogo, sidebarMenuItems } from '@/layouts/config/navigation'
import Header from '@/layouts/Header/Header'
import MainLayout from '@/layouts/MainLayout/MainLayout'
import Sidebar from '@/layouts/Sidebar/Sidebar'
import { getErrorMessage } from '@/shared/api/api-error'
import Toast from '@/shared/components/feedback/Toast'
import ConfirmModal from '@/shared/components/ui/ConfirmModal/ConfirmModal'
import StatusBadge, { type StatusBadgeTone } from '@/shared/components/ui/StatusBadge/StatusBadge'
import { useHeaderProfile } from '@/shared/hooks/useHeaderProfile'
import { useResponsiveSidebar } from '@/shared/hooks/useResponsiveSidebar'
import { useToast } from '@/shared/hooks/useToast'
import type { SidebarItemKey } from '@/shared/types/layout'
import styles from './ShelterListPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'shelter-list'
const SKELETON_ROW_COUNT = 6

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

const resolveShelterStatusUi = (value: boolean | null | undefined): { label: string; tone: StatusBadgeTone } => {
  if (value === true) {
    return { label: 'Active', tone: 'positive' }
  }

  if (value === false) {
    return { label: 'Inactive', tone: 'danger' }
  }

  return { label: 'N/A', tone: 'neutral' }
}

const resolveShelterVisibilityUi = (value: boolean | null | undefined): { label: string; tone: StatusBadgeTone } => {
  if (value === true) {
    return { label: 'Hidden', tone: 'danger' }
  }

  if (value === false) {
    return { label: 'Public', tone: 'positive' }
  }

  return { label: 'N/A', tone: 'neutral' }
}

interface ShelterListPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

function ShelterListPage({ onLogout, session }: ShelterListPageProps) {
  const { clearToast, showToast, toast } = useToast()
  const [searchValue, setSearchValue] = useState('')
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const resolvedHeaderProfile = useHeaderProfile({
    fallbackProfile: defaultHeaderProfile,
    session,
  })
  const [shelters, setShelters] = useState<Shelter[]>([])
  const [isLoadingShelters, setIsLoadingShelters] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingShelterId, setEditingShelterId] = useState<string | null>(null)
  const [shelterName, setShelterName] = useState('')
  const [shelterNameError, setShelterNameError] = useState('')
  const [editShelterName, setEditShelterName] = useState('')
  const [editShelterNameError, setEditShelterNameError] = useState('')
  const [editShelterApproved, setEditShelterApproved] = useState(false)
  const [editShelterActive, setEditShelterActive] = useState(false)
  const [editShelterHidden, setEditShelterHidden] = useState(false)
  const [isSavingShelter, setIsSavingShelter] = useState(false)
  const [isUpdatingShelter, setIsUpdatingShelter] = useState(false)
  const [viewingShelter, setViewingShelter] = useState<Shelter | null>(null)
  const [isRefreshingViewedShelter, setIsRefreshingViewedShelter] = useState(false)
  const [shelterIdBeingToggled, setShelterIdBeingToggled] = useState<string | null>(null)
  const [pendingToggleShelter, setPendingToggleShelter] = useState<{
    id: string
    name: string
    nextActive: boolean
  } | null>(null)
  const latestViewRequestIdRef = useRef(0)
  const accessToken = session?.accessToken?.trim() ?? ''
  const navigate = useNavigate()

  const loadShelters = useCallback(async () => {
    if (!accessToken) {
      setShelters([])
      return
    }

    setIsLoadingShelters(true)

    try {
      const shelterList = await shelterService.list(accessToken)
      setShelters(Array.isArray(shelterList) ? shelterList : [])
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsLoadingShelters(false)
    }
  }, [accessToken, showToast])

  useEffect(() => {
    clearToast()
    void loadShelters()
  }, [clearToast, loadShelters])

  const filteredShelters = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()
    if (!normalizedSearch) {
      return shelters
    }

    return shelters.filter((shelter) => {
      const normalizedName = shelter.name?.trim().toLowerCase() ?? ''
      const normalizedId = shelter.id?.trim().toLowerCase() ?? ''

      return normalizedName.includes(normalizedSearch) || normalizedId.includes(normalizedSearch)
    })
  }, [searchValue, shelters])

  const skeletonRowIndexes = useMemo(
    () => Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => index),
    [],
  )

  const closeCreateModal = useCallback(() => {
    setIsCreateModalOpen(false)
    setShelterName('')
    setShelterNameError('')
  }, [])

  const closeEditModal = useCallback(() => {
    setIsEditModalOpen(false)
    setEditingShelterId(null)
    setEditShelterName('')
    setEditShelterNameError('')
    setEditShelterApproved(false)
    setEditShelterActive(false)
    setEditShelterHidden(false)
  }, [])

  const closeViewModal = useCallback(() => {
    latestViewRequestIdRef.current += 1
    setIsRefreshingViewedShelter(false)
    setViewingShelter(null)
  }, [])

  const handleOpenCreateModal = () => {
    setShelterName('')
    setShelterNameError('')
    setIsCreateModalOpen(true)
  }

  const handleCreateShelterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!accessToken) {
      showToast('You need to sign in before managing shelters.', { variant: 'error' })
      return
    }

    const persistShelter = async () => {
      const trimmedName = shelterName.trim()
      setShelterNameError('')

      if (!trimmedName) {
        setShelterNameError('Shelter name is required.')
        showToast('Shelter name is required.', { variant: 'error' })
        return
      }

      setIsSavingShelter(true)

      try {
        await shelterService.create({ name: trimmedName }, accessToken)
        showToast('Shelter created successfully.', { variant: 'success' })
        closeCreateModal()
        await loadShelters()
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setIsSavingShelter(false)
      }
    }

    void persistShelter()
  }

  const handleViewShelter = (shelter: Shelter) => {
    setViewingShelter(shelter)

    if (!accessToken) {
      return
    }

    const requestId = latestViewRequestIdRef.current + 1
    latestViewRequestIdRef.current = requestId
    setIsRefreshingViewedShelter(true)

    const hydrateViewedShelter = async () => {
      try {
        const fullShelter = await shelterService.getOne(shelter.id, accessToken)
        if (requestId !== latestViewRequestIdRef.current) {
          return
        }

        setViewingShelter(fullShelter)
      } catch (error) {
        if (requestId !== latestViewRequestIdRef.current) {
          return
        }

        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        if (requestId === latestViewRequestIdRef.current) {
          setIsRefreshingViewedShelter(false)
        }

      }
    }

    void hydrateViewedShelter()
  }

  const handleOpenEditModal = (shelter: Shelter) => {
    setEditingShelterId(shelter.id)
    setEditShelterName(shelter.name?.trim() ?? '')
    setEditShelterNameError('')
    setEditShelterApproved(shelter.approved === true)
    setEditShelterActive(shelter.active === true)
    setEditShelterHidden(shelter.hidden === true)
    setIsEditModalOpen(true)
  }

  const handleUpdateShelterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!accessToken) {
      showToast('You need to sign in before managing shelters.', { variant: 'error' })
      return
    }

    if (!editingShelterId) {
      showToast('Unable to update shelter. Please try again.', { variant: 'error' })
      return
    }

    const updateShelter = async () => {
      const trimmedName = editShelterName.trim()
      setEditShelterNameError('')

      if (!trimmedName) {
        setEditShelterNameError('Shelter name is required.')
        showToast('Shelter name is required.', { variant: 'error' })
        return
      }

      setIsUpdatingShelter(true)

      try {
        const payload = {
          active: editShelterActive,
          approved: editShelterApproved,
          hidden: editShelterHidden,
          name: trimmedName,
        }

        const updatedShelter = await shelterService.update(editingShelterId, payload, accessToken)
        const nextShelter: Shelter = {
          ...updatedShelter,
          active:
            typeof updatedShelter.active === 'boolean' ? updatedShelter.active : payload.active,
          approved:
            typeof updatedShelter.approved === 'boolean' ? updatedShelter.approved : payload.approved,
          hidden:
            typeof updatedShelter.hidden === 'boolean' ? updatedShelter.hidden : payload.hidden,
          name: updatedShelter.name?.trim() ? updatedShelter.name : payload.name,
        }

        setShelters((currentShelters) =>
          currentShelters.map((currentShelter) =>
            currentShelter.id === editingShelterId ? { ...currentShelter, ...nextShelter } : currentShelter,
          ),
        )

        setViewingShelter((currentViewingShelter) =>
          currentViewingShelter?.id === editingShelterId
            ? { ...currentViewingShelter, ...nextShelter }
            : currentViewingShelter,
        )

        showToast('Shelter updated successfully.', { variant: 'success' })
        closeEditModal()
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setIsUpdatingShelter(false)
      }
    }

    void updateShelter()
  }

  const resolveShelterActiveValue = (shelter: Shelter) => shelter.active === true
  const resolveShelterHiddenValue = (shelter: Shelter) => shelter.hidden === true

  const handleToggleShelterActive = (shelterId: string, nextActive: boolean) => {
    if (!accessToken) {
      setPendingToggleShelter(null)
      showToast('You need to sign in before managing shelters.', { variant: 'error' })
      return
    }

    const toggleShelterActiveRequest = async () => {
      setShelterIdBeingToggled(shelterId)

      try {
        const updatedShelter = await shelterService.toggleActive(shelterId, nextActive, accessToken)
        const resolvedActiveValue =
          typeof updatedShelter.active === 'boolean' ? updatedShelter.active : nextActive

        setShelters((currentShelters) =>
          currentShelters.map((currentShelter) =>
            currentShelter.id === shelterId
              ? {
                  ...currentShelter,
                  ...updatedShelter,
                  active: resolvedActiveValue,
                }
              : currentShelter,
          ),
        )

        setViewingShelter((currentViewingShelter) =>
          currentViewingShelter?.id === shelterId
            ? {
                ...currentViewingShelter,
                ...updatedShelter,
                active: resolvedActiveValue,
              }
            : currentViewingShelter,
        )

        showToast(`Shelter ${resolvedActiveValue ? 'enabled' : 'disabled'} successfully.`, {
          variant: 'success',
        })
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setPendingToggleShelter(null)
        setShelterIdBeingToggled(null)
      }
    }

    void toggleShelterActiveRequest()
  }

  const handleToggleShelterActiveRequest = (shelter: Shelter) => {
    const currentActiveValue = resolveShelterActiveValue(shelter)
    setPendingToggleShelter({
      id: shelter.id,
      name: shelter.name?.trim() || 'this shelter',
      nextActive: !currentActiveValue,
    })
  }

  const handleToggleShelterConfirm = () => {
    if (!pendingToggleShelter) {
      return
    }

    handleToggleShelterActive(pendingToggleShelter.id, pendingToggleShelter.nextActive)
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
          <div className={styles.headingRow}>
            <h1 className={styles.pageTitle}>Shelter Management</h1>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                navigate(APP_ROUTES.shelterAssociation)
              }}
            >
              Associate Users
            </button>
          </div>

          <div className={styles.tablePanel}>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Shelter Name</th>
                    <th scope="col">Status</th>
                    <th scope="col">Visibility</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {isLoadingShelters ? (
                    skeletonRowIndexes.map((rowIndex) => (
                      <tr key={`shelter-skeleton-${rowIndex}`} aria-hidden="true">
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonText}`} />
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
                  ) : filteredShelters.length === 0 ? (
                    <tr>
                      <td colSpan={4} className={styles.tableStateCell}>
                        No shelters found.
                      </td>
                    </tr>
                  ) : (
                    filteredShelters.map((shelter) => {
                      const isActive = resolveShelterActiveValue(shelter)
                      const isToggleDisabled = shelterIdBeingToggled === shelter.id
                      const shelterStatus = resolveShelterStatusUi(shelter.active)
                      const shelterVisibility = resolveShelterVisibilityUi(shelter.hidden)

                      return (
                        <tr
                          key={shelter.id}
                          className={styles.clickableRow}
                          onClick={() => {
                            handleViewShelter(shelter)
                          }}
                        >
                        <td>{shelter.name?.trim() || 'Unnamed Shelter'}</td>
                        <td>
                          <StatusBadge label={shelterStatus.label} tone={shelterStatus.tone} />
                        </td>
                        <td>
                          <StatusBadge label={shelterVisibility.label} tone={shelterVisibility.tone} />
                        </td>
                        <td>
                          <div className={styles.actionCell}>
                            <button
                              type="button"
                              className={styles.actionButton}
                              aria-label={`Edit ${shelter.name?.trim() || 'shelter'}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleOpenEditModal(shelter)
                              }}
                            >
                              <FaEdit aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className={`${styles.actionButton} ${styles.toggleActionButton} ${
                                isActive ? styles.disableActionButton : styles.enableActionButton
                              }`}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleToggleShelterActiveRequest(shelter)
                              }}
                              disabled={isToggleDisabled}
                            >
                              {isActive ? 'Disable' : 'Enable'}
                            </button>
                          </div>
                        </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              className={styles.floatingAddButton}
              aria-label="Create shelter"
              onClick={handleOpenCreateModal}
            >
              <span className={styles.floatingAddIcon}>
                <FaPlus aria-hidden="true" />
              </span>
              <span className={styles.floatingAddLabel}>Add Shelter</span>
            </button>
          </div>

        </section>
      </div>

      {viewingShelter ? (
        <div className={styles.modalOverlay} onClick={closeViewModal}>
          <div
            className={`${styles.modalCard} ${styles.viewModalCard}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-shelter-modal-title"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className={styles.modalHeader}>
              <h2 id="view-shelter-modal-title" className={styles.modalTitle}>
                Shelter Details
              </h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeViewModal}
                aria-label="Close shelter details modal"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className={styles.viewModalBody}>
              {isRefreshingViewedShelter ? (
                <p className={styles.refreshingText}>Refreshing shelter details...</p>
              ) : null}

              <div className={styles.viewDetailsGrid}>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Name</span>
                  <span className={styles.viewDetailValue}>{viewingShelter.name?.trim() || 'N/A'}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Status</span>
                  <span className={styles.viewDetailValue}>
                    <StatusBadge
                      label={resolveShelterStatusUi(viewingShelter.active).label}
                      tone={resolveShelterStatusUi(viewingShelter.active).tone}
                    />
                  </span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Visibility</span>
                  <span className={styles.viewDetailValue}>
                    <StatusBadge
                      label={resolveShelterVisibilityUi(viewingShelter.hidden).label}
                      tone={resolveShelterVisibilityUi(viewingShelter.hidden).tone}
                    />
                  </span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Created Date</span>
                  <span className={styles.viewDetailValue}>
                    {formatDateLabel(viewingShelter.createdDate ?? viewingShelter.createdAt)}
                  </span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Updated Date</span>
                  <span className={styles.viewDetailValue}>
                    {formatDateLabel(viewingShelter.updatedDate ?? viewingShelter.updatedAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={`${styles.modalSubmitButton} ${styles.viewToggleButton} ${
                  resolveShelterActiveValue(viewingShelter) ? styles.viewDisableButton : styles.viewEnableButton
                }`}
                onClick={() => {
                  handleToggleShelterActiveRequest(viewingShelter)
                }}
                disabled={shelterIdBeingToggled === viewingShelter.id}
              >
                {resolveShelterActiveValue(viewingShelter) ? 'Disable' : 'Enable'}
              </button>
              <button type="button" className={styles.modalCancelButton} onClick={closeViewModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={Boolean(pendingToggleShelter)}
        title={`${pendingToggleShelter?.nextActive ? 'Enable' : 'Disable'} shelter?`}
        message={`Are you sure you want to ${pendingToggleShelter?.nextActive ? 'enable' : 'disable'} ${
          pendingToggleShelter?.name ?? 'this shelter'
        }?`}
        confirmLabel={pendingToggleShelter?.nextActive ? 'Enable' : 'Disable'}
        confirmTone={pendingToggleShelter?.nextActive ? 'success' : 'danger'}
        cancelLabel="Cancel"
        ariaLabel={`${pendingToggleShelter?.nextActive ? 'Enable' : 'Disable'} shelter confirmation`}
        isBusy={shelterIdBeingToggled !== null}
        onCancel={() => {
          setPendingToggleShelter(null)
        }}
        onConfirm={handleToggleShelterConfirm}
      />

      {isCreateModalOpen ? (
        <div className={styles.modalOverlay} onClick={closeCreateModal}>
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-shelter-modal-title"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className={styles.modalHeader}>
              <h2 id="create-shelter-modal-title" className={styles.modalTitle}>
                Add Shelter
              </h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeCreateModal}
                aria-label="Close add shelter modal"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={handleCreateShelterSubmit} noValidate>
              <label className={styles.fieldLabel}>
                <span>
                  Shelter Name <span className={styles.requiredAsterisk}>*</span>
                </span>
                <input
                  type="text"
                  value={shelterName}
                  onChange={(event) => {
                    setShelterNameError('')
                    setShelterName(event.target.value)
                  }}
                  className={`${styles.fieldInput}${shelterNameError ? ` ${styles.fieldInputError}` : ''}`}
                  placeholder="e.g. Paw Haven Shelter"
                />
                {shelterNameError ? <span className={styles.fieldErrorText}>{shelterNameError}</span> : null}
              </label>

              <div className={styles.modalActions}>
                <button type="button" className={styles.modalCancelButton} onClick={closeCreateModal}>
                  Cancel
                </button>
                <button type="submit" className={styles.modalSubmitButton} disabled={isSavingShelter}>
                  {isSavingShelter ? 'Saving...' : 'Create Shelter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isEditModalOpen ? (
        <div className={styles.modalOverlay} onClick={closeEditModal}>
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-shelter-modal-title"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className={styles.modalHeader}>
              <h2 id="edit-shelter-modal-title" className={styles.modalTitle}>
                Edit Shelter
              </h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeEditModal}
                aria-label="Close edit shelter modal"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={handleUpdateShelterSubmit} noValidate>
              <label className={styles.fieldLabel}>
                <span>
                  Shelter Name <span className={styles.requiredAsterisk}>*</span>
                </span>
                <input
                  type="text"
                  value={editShelterName}
                  onChange={(event) => {
                    setEditShelterNameError('')
                    setEditShelterName(event.target.value)
                  }}
                  className={`${styles.fieldInput}${editShelterNameError ? ` ${styles.fieldInputError}` : ''}`}
                  placeholder="e.g. Paw Haven Shelter"
                />
                {editShelterNameError ? <span className={styles.fieldErrorText}>{editShelterNameError}</span> : null}
              </label>

              <label className={styles.toggleCard}>
                <span className={styles.toggleCopy}>
                  <span className={styles.toggleLabel}>Active</span>
                  <span className={styles.toggleHint}>Allow shelter admins and users to access this shelter.</span>
                </span>
                <input
                  type="checkbox"
                  checked={editShelterActive}
                  onChange={(event) => {
                    setEditShelterActive(event.target.checked)
                  }}
                  className={styles.toggleInput}
                />
                <span className={styles.toggleTrack} aria-hidden="true">
                  <span className={styles.toggleThumb} />
                </span>
              </label>

              <label className={styles.toggleCard}>
                <span className={styles.toggleCopy}>
                  <span className={styles.toggleLabel}>Visible In Public List</span>
                  <span className={styles.toggleHint}>Show this shelter in signup shelter selection.</span>
                </span>
                <input
                  type="checkbox"
                  checked={!editShelterHidden}
                  onChange={(event) => {
                    setEditShelterHidden(!event.target.checked)
                  }}
                  className={styles.toggleInput}
                />
                <span className={styles.toggleTrack} aria-hidden="true">
                  <span className={styles.toggleThumb} />
                </span>
              </label>

              <div className={styles.modalActions}>
                <button type="button" className={styles.modalCancelButton} onClick={closeEditModal}>
                  Cancel
                </button>
                <button type="submit" className={styles.modalSubmitButton} disabled={isUpdatingShelter}>
                  {isUpdatingShelter ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </MainLayout>
  )
}

export default ShelterListPage
