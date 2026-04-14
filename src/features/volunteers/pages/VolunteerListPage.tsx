import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { FaEdit, FaPlus, FaTimes, FaTrashAlt } from 'react-icons/fa'
import { useLocation, useNavigate } from 'react-router-dom'
import volunteerFallbackImage from '@/assets/volunteer-icon.png'
import type { AuthSession } from '@/features/auth/types/auth-api'
import {
  DEFAULT_ADD_VOLUNTEER_FORM,
  LIST_BATCH_SIZE,
  LIST_INITIAL_BATCH_SIZE,
  LIST_SKELETON_ROW_COUNT,
  type AddVolunteerForm,
} from '@/features/volunteers/constants/volunteer-list.constants'
import { volunteerService } from '@/features/volunteers/services/volunteer.service'
import type { VolunteerRecord } from '@/features/volunteers/types/volunteer-api'
import {
  buildVolunteerPayload,
  mapVolunteerToForm,
  toTitleCase,
} from '@/features/volunteers/utils/volunteer-form'
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
import styles from './VolunteerListPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'volunteer-list'

const normalizeText = (value?: string | null) => value?.trim() || ''

const formatDateLabel = (value?: string | null) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return 'N/A'
  }

  const parsedDate = new Date(normalized.length === 10 ? `${normalized}T00:00:00` : normalized)
  if (Number.isNaN(parsedDate.getTime())) {
    return 'N/A'
  }

  return parsedDate.toLocaleDateString('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const formatTimeLabel = (value?: string | null) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return 'N/A'
  }

  const timeMatch = normalized.match(/^(\d{1,2}):(\d{2})/)
  if (!timeMatch) {
    return normalized
  }

  const date = new Date(2000, 0, 1, Number(timeMatch[1]), Number(timeMatch[2]))
  return date.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    hour12: true,
    minute: '2-digit',
  })
}

const formatScheduleLabel = (volunteer: VolunteerRecord) => {
  const startLabel = formatDateLabel(volunteer.startDate)
  const endLabel = formatDateLabel(volunteer.endDate || volunteer.startDate)
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`
}

const formatTimeRangeLabel = (volunteer: VolunteerRecord) => {
  const startTimeLabel = formatTimeLabel(volunteer.startTime)
  const endTimeLabel = formatTimeLabel(volunteer.endTime)

  if (startTimeLabel === 'N/A' && endTimeLabel === 'N/A') {
    return 'N/A'
  }

  if (startTimeLabel === 'N/A') {
    return endTimeLabel
  }

  if (endTimeLabel === 'N/A') {
    return startTimeLabel
  }

  return `${startTimeLabel} - ${endTimeLabel}`
}

const resolveJoinCount = (volunteer: VolunteerRecord) => {
  const fromList = Array.isArray(volunteer.joinedUsers) ? volunteer.joinedUsers.length : 0
  const fromField =
    typeof volunteer.totalJoin === 'number'
      ? volunteer.totalJoin
      : typeof volunteer.totalJoin === 'string'
        ? Number.parseInt(volunteer.totalJoin, 10) || 0
        : 0

  return Math.max(fromField, fromList)
}

const resolveSortTime = (volunteer: VolunteerRecord) => {
  const startDate = normalizeText(volunteer.startDate)
  if (!startDate) {
    return 0
  }

  const time = normalizeText(volunteer.startTime) || '00:00'
  const parsedDate = new Date(`${startDate}T${time}:00`)
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime()
}

const formatJoinedUsersLabel = (volunteer: VolunteerRecord) => {
  if (!Array.isArray(volunteer.joinedUsers) || volunteer.joinedUsers.length === 0) {
    return 'N/A'
  }

  return volunteer.joinedUsers
    .map((joinedUser) => {
      const fullName = [joinedUser.firstName, joinedUser.middleName, joinedUser.lastName]
        .map((namePart) => normalizeText(namePart))
        .filter(Boolean)
        .join(' ')

      return fullName || joinedUser.id
    })
    .join(', ')
}

interface VolunteerListPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

function VolunteerListPage({ onLogout, session }: VolunteerListPageProps) {
  const { clearToast, showToast, toast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchValue, setSearchValue] = useState('')
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const resolvedHeaderProfile = useHeaderProfile({ fallbackProfile: defaultHeaderProfile, session })
  const accessToken = session?.accessToken?.trim() ?? ''

  const [volunteers, setVolunteers] = useState<VolunteerRecord[]>([])
  const [isLoadingVolunteers, setIsLoadingVolunteers] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [viewingVolunteer, setViewingVolunteer] = useState<VolunteerRecord | null>(null)
  const [editingVolunteerId, setEditingVolunteerId] = useState<string | null>(null)
  const [isSavingVolunteer, setIsSavingVolunteer] = useState(false)
  const [volunteerIdBeingDeleted, setVolunteerIdBeingDeleted] = useState<string | null>(null)
  const [pendingDeleteVolunteer, setPendingDeleteVolunteer] = useState<{ id: string; title: string } | null>(null)
  const [addVolunteerForm, setAddVolunteerForm] = useState<AddVolunteerForm>(DEFAULT_ADD_VOLUNTEER_FORM)
  const [titleError, setTitleError] = useState('')
  const [startDateError, setStartDateError] = useState('')
  const [endDateError, setEndDateError] = useState('')
  const [startTimeError, setStartTimeError] = useState('')
  const [endTimeError, setEndTimeError] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [visibleVolunteerCount, setVisibleVolunteerCount] = useState(LIST_INITIAL_BATCH_SIZE)
  const tableScrollRef = useRef<HTMLDivElement | null>(null)
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null)

  const loadVolunteers = useCallback(async () => {
    if (!accessToken) {
      setVolunteers([])
      return
    }

    setIsLoadingVolunteers(true)
    try {
      const volunteerList = await volunteerService.list(accessToken)
      setVolunteers(
        [...(Array.isArray(volunteerList) ? volunteerList : [])].sort(
          (a, b) => resolveSortTime(b) - resolveSortTime(a),
        ),
      )
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsLoadingVolunteers(false)
    }
  }, [accessToken, showToast])

  useEffect(() => {
    clearToast()
    void loadVolunteers()
  }, [clearToast, loadVolunteers])

  const filteredVolunteers = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()
    if (!normalizedSearch) {
      return volunteers
    }

    return volunteers.filter((volunteer) => {
      const haystack = [
        volunteer.title,
        volunteer.description,
        volunteer.startDate,
        volunteer.endDate,
        volunteer.startTime,
        volunteer.endTime,
        volunteer.link,
        String(resolveJoinCount(volunteer)),
      ]
        .map((value) => normalizeText(value).toLowerCase())
        .join(' ')

      return haystack.includes(normalizedSearch)
    })
  }, [searchValue, volunteers])

  useEffect(() => {
    setVisibleVolunteerCount(LIST_INITIAL_BATCH_SIZE)
  }, [filteredVolunteers])

  const visibleVolunteers = useMemo(
    () => filteredVolunteers.slice(0, visibleVolunteerCount),
    [filteredVolunteers, visibleVolunteerCount],
  )
  const hasMoreVolunteersToReveal = visibleVolunteers.length < filteredVolunteers.length
  const skeletonRowIndexes = useMemo(
    () => Array.from({ length: LIST_SKELETON_ROW_COUNT }, (_, index) => index),
    [],
  )

  useEffect(() => {
    const scrollContainer = tableScrollRef.current
    const triggerElement = loadMoreTriggerRef.current
    if (!scrollContainer || !triggerElement || isLoadingVolunteers || !hasMoreVolunteersToReveal) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) {
          return
        }

        setVisibleVolunteerCount((currentCount) =>
          Math.min(currentCount + LIST_BATCH_SIZE, filteredVolunteers.length),
        )
      },
      { root: scrollContainer, rootMargin: '120px 0px', threshold: 0.05 },
    )

    observer.observe(triggerElement)
    return () => observer.disconnect()
  }, [filteredVolunteers.length, hasMoreVolunteersToReveal, isLoadingVolunteers])

  const closeAddModal = useCallback(() => {
    setIsAddModalOpen(false)
    setEditingVolunteerId(null)
    setAddVolunteerForm(DEFAULT_ADD_VOLUNTEER_FORM)
    setTitleError('')
    setStartDateError('')
    setEndDateError('')
    setStartTimeError('')
    setEndTimeError('')
    setPhotoError('')
  }, [])

  const closeViewModal = useCallback(() => {
    setViewingVolunteer(null)
  }, [])

  const openAddVolunteerModal = useCallback(() => {
    setEditingVolunteerId(null)
    setAddVolunteerForm(DEFAULT_ADD_VOLUNTEER_FORM)
    setTitleError('')
    setStartDateError('')
    setEndDateError('')
    setStartTimeError('')
    setEndTimeError('')
    setPhotoError('')
    setIsAddModalOpen(true)
  }, [])

  useEffect(() => {
    const state = location.state as { openAddModal?: boolean } | null
    if (!state?.openAddModal) {
      return
    }

    openAddVolunteerModal()
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate, openAddVolunteerModal])

  const handleViewVolunteer = (volunteer: VolunteerRecord) => {
    setViewingVolunteer(volunteer)

    if (!accessToken) {
      return
    }

    const loadVolunteerDetails = async () => {
      try {
        const detailedVolunteer = await volunteerService.getOne(volunteer.id, accessToken)
        setViewingVolunteer((currentVolunteer) =>
          currentVolunteer?.id === volunteer.id ? detailedVolunteer : currentVolunteer,
        )
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      }
    }

    void loadVolunteerDetails()
  }

  const handleAddVolunteerSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!accessToken) {
      showToast('You need to sign in before managing volunteers.', { variant: 'error' })
      return
    }

    const persistVolunteer = async () => {
      const title = addVolunteerForm.title.trim()
      const startDate = addVolunteerForm.startDate.trim()
      const endDate = addVolunteerForm.endDate.trim()
      const startTime = addVolunteerForm.startTime.trim()
      const endTime = addVolunteerForm.endTime.trim()

      setTitleError('')
      setStartDateError('')
      setEndDateError('')
      setStartTimeError('')
      setEndTimeError('')
      setPhotoError('')

      if (!title || !startDate || !endDate || !startTime || !endTime) {
        if (!title) {
          setTitleError('Title is required.')
        }

        if (!startDate) {
          setStartDateError('Start date is required.')
        }

        if (!endDate) {
          setEndDateError('End date is required.')
        }

        if (!startTime) {
          setStartTimeError('Start time is required.')
        }

        if (!endTime) {
          setEndTimeError('End time is required.')
        }

        showToast('Please complete Title, Start Date, End Date, Start Time, and End Time.', {
          variant: 'error',
        })
        return
      }

      if (endDate < startDate) {
        setEndDateError('End date cannot be earlier than start date.')
        showToast('End date cannot be earlier than start date.', { variant: 'error' })
        return
      }

      if (startDate === endDate && endTime < startTime) {
        setEndTimeError('End time cannot be earlier than start time when dates are the same.')
        showToast('End time cannot be earlier than start time when dates are the same.', {
          variant: 'error',
        })
        return
      }

      if (!addVolunteerForm.photo.trim()) {
        const message = 'Volunteer photo is required.'
        setPhotoError(message)
        showToast(message, { variant: 'error' })
        return
      }

      setIsSavingVolunteer(true)
      try {
        const payload = buildVolunteerPayload(addVolunteerForm)
        if (editingVolunteerId) {
          await volunteerService.update(editingVolunteerId, payload, accessToken)
          showToast('Volunteer updated successfully.', { variant: 'success' })
        } else {
          await volunteerService.create(payload, accessToken)
          showToast('Volunteer added successfully.', { variant: 'success' })
        }

        closeAddModal()
        await loadVolunteers()
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setIsSavingVolunteer(false)
      }
    }

    void persistVolunteer()
  }

  const handleEditVolunteer = (volunteer: VolunteerRecord) => {
    setEditingVolunteerId(volunteer.id)
    setAddVolunteerForm(mapVolunteerToForm(volunteer))
    setTitleError('')
    setStartDateError('')
    setEndDateError('')
    setStartTimeError('')
    setEndTimeError('')
    setPhotoError('')
    setIsAddModalOpen(true)
  }

  const handleDeleteVolunteer = (volunteerId: string) => {
    if (!accessToken) {
      setPendingDeleteVolunteer(null)
      showToast('You need to sign in before managing volunteers.', { variant: 'error' })
      return
    }

    const deleteVolunteer = async () => {
      setVolunteerIdBeingDeleted(volunteerId)

      try {
        await volunteerService.delete(volunteerId, accessToken)
        setVolunteers((currentVolunteers) =>
          currentVolunteers.filter((volunteer) => volunteer.id !== volunteerId),
        )
        setViewingVolunteer((currentVolunteer) =>
          currentVolunteer?.id === volunteerId ? null : currentVolunteer,
        )
        showToast('Volunteer removed successfully.', { variant: 'success' })
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setPendingDeleteVolunteer(null)
        setVolunteerIdBeingDeleted(null)
      }
    }

    void deleteVolunteer()
  }

  const handleDeleteVolunteerRequest = (volunteer: VolunteerRecord) => {
    setPendingDeleteVolunteer({
      id: volunteer.id,
      title: normalizeText(volunteer.title) || 'this volunteer listing',
    })
  }

  const handleDeleteVolunteerConfirm = () => {
    if (!pendingDeleteVolunteer) {
      return
    }

    handleDeleteVolunteer(pendingDeleteVolunteer.id)
  }

  const handleViewEdit = () => {
    if (!viewingVolunteer) {
      return
    }

    const volunteerToEdit = viewingVolunteer
    closeViewModal()
    handleEditVolunteer(volunteerToEdit)
  }

  const handleViewDelete = () => {
    if (!viewingVolunteer) {
      return
    }

    handleDeleteVolunteerRequest(viewingVolunteer)
    closeViewModal()
  }

  return (
    <MainLayout
      isSidebarOpen={isSidebarOpen}
      onSidebarClose={() => setIsSidebarOpen(false)}
      header={
        <Header
          profile={resolvedHeaderProfile}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          isMenuOpen={isSidebarOpen}
          onMenuToggle={() => setIsSidebarOpen((prevState) => !prevState)}
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
          <h1 className={styles.pageTitle}>Volunteer List</h1>

          <div className={styles.tablePanel}>
            <div className={styles.tableScroll} ref={tableScrollRef}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Image</th>
                    <th scope="col">Title</th>
                    <th scope="col">Schedule</th>
                    <th scope="col">Time</th>
                    <th scope="col">Total Join</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {isLoadingVolunteers ? (
                    skeletonRowIndexes.map((rowIndex) => (
                      <tr key={`volunteer-skeleton-${rowIndex}`} aria-hidden="true">
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonImage}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonTextWide}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonTextWide}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonText}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonText}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonAction}`} />
                        </td>
                      </tr>
                    ))
                  ) : filteredVolunteers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={styles.tableStateCell}>
                        No volunteer listings found.
                      </td>
                    </tr>
                  ) : (
                    visibleVolunteers.map((volunteer) => (
                      <tr
                        key={volunteer.id}
                        className={styles.clickableRow}
                        onClick={() => {
                          handleViewVolunteer(volunteer)
                        }}
                      >
                        <td>
                          <img
                            src={normalizeText(volunteer.photo) || volunteerFallbackImage}
                            alt={volunteer.title || 'Volunteer'}
                            className={styles.petImage}
                          />
                        </td>
                        <td>{volunteer.title || 'Untitled Volunteer'}</td>
                        <td>{formatScheduleLabel(volunteer)}</td>
                        <td>{formatTimeRangeLabel(volunteer)}</td>
                        <td>{resolveJoinCount(volunteer)}</td>
                        <td>
                          <div className={styles.actionCell}>
                            <button
                              type="button"
                              className={styles.actionButton}
                              aria-label={`Edit ${normalizeText(volunteer.title) || 'volunteer listing'}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleEditVolunteer(volunteer)
                              }}
                            >
                              <FaEdit aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className={`${styles.actionButton} ${styles.deleteButton}`}
                              aria-label={`Delete ${normalizeText(volunteer.title) || 'volunteer listing'}`}
                              disabled={volunteerIdBeingDeleted === volunteer.id}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleDeleteVolunteerRequest(volunteer)
                              }}
                            >
                              <FaTrashAlt aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {hasMoreVolunteersToReveal ? (
                <div ref={loadMoreTriggerRef} className={styles.loadMoreTrigger} />
              ) : null}
            </div>

            <button
              type="button"
              className={styles.floatingAddButton}
              aria-label="Add volunteer listing"
              onClick={openAddVolunteerModal}
            >
              <span className={styles.floatingAddIcon}>
                <FaPlus aria-hidden="true" />
              </span>
              <span className={styles.floatingAddLabel}>Add Volunteer</span>
            </button>
          </div>

          <footer className={styles.tableFooter}>
            <span className={styles.footerText}>
              Showing {visibleVolunteers.length} of {filteredVolunteers.length}
            </span>
          </footer>
        </section>
      </div>

      {viewingVolunteer ? (
        <div className={styles.modalOverlay} onClick={closeViewModal}>
          <div
            className={`${styles.modalCard} ${styles.viewModalCard}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-volunteer-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 id="view-volunteer-modal-title" className={styles.modalTitle}>
                Volunteer Details
              </h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeViewModal}
                aria-label="Close volunteer details modal"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className={styles.viewModalBody}>
              <div className={styles.viewMedia}>
                <img
                  src={normalizeText(viewingVolunteer.photo) || volunteerFallbackImage}
                  alt={viewingVolunteer.title || 'Volunteer'}
                  className={styles.viewImage}
                />
              </div>
              <div className={styles.viewDetailsGrid}>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Title</span>
                  <span className={styles.viewDetailValue}>{viewingVolunteer.title || 'N/A'}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Start Date</span>
                  <span className={styles.viewDetailValue}>{formatDateLabel(viewingVolunteer.startDate)}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>End Date</span>
                  <span className={styles.viewDetailValue}>{formatDateLabel(viewingVolunteer.endDate)}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Start Time</span>
                  <span className={styles.viewDetailValue}>{formatTimeLabel(viewingVolunteer.startTime)}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>End Time</span>
                  <span className={styles.viewDetailValue}>{formatTimeLabel(viewingVolunteer.endTime)}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Total Join</span>
                  <span className={styles.viewDetailValue}>{resolveJoinCount(viewingVolunteer)}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Created Date</span>
                  <span className={styles.viewDetailValue}>{formatDateLabel(viewingVolunteer.createdDate)}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Updated Date</span>
                  <span className={styles.viewDetailValue}>{formatDateLabel(viewingVolunteer.updatedDate)}</span>
                </div>
                <div className={`${styles.viewDetailItem} ${styles.viewDetailItemWide}`}>
                  <span className={styles.viewDetailLabel}>Link</span>
                  {normalizeText(viewingVolunteer.link) ? (
                    <a
                      href={viewingVolunteer.link ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.viewDetailValue}
                    >
                      {viewingVolunteer.link}
                    </a>
                  ) : (
                    <span className={styles.viewDetailValue}>N/A</span>
                  )}
                </div>
                <div className={`${styles.viewDetailItem} ${styles.viewDetailItemWide}`}>
                  <span className={styles.viewDetailLabel}>Joined Users</span>
                  <p className={styles.viewDescription}>{formatJoinedUsersLabel(viewingVolunteer)}</p>
                </div>
                <div className={`${styles.viewDetailItem} ${styles.viewDetailItemWide}`}>
                  <span className={styles.viewDetailLabel}>Description</span>
                  <p className={styles.viewDescription}>{viewingVolunteer.description || 'N/A'}</p>
                </div>
              </div>
            </div>

            <div className={`${styles.modalActions} ${styles.viewModalActions}`}>
              <button type="button" className={styles.modalCancelButton} onClick={closeViewModal}>
                Close
              </button>
              <button type="button" className={styles.modalSubmitButton} onClick={handleViewEdit}>
                Edit
              </button>
              <button
                type="button"
                className={`${styles.modalSubmitButton} ${styles.viewDeleteButton}`}
                onClick={handleViewDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isAddModalOpen ? (
        <div className={styles.modalOverlay} onClick={closeAddModal}>
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-volunteer-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 id="add-volunteer-modal-title" className={styles.modalTitle}>
                {editingVolunteerId ? 'Edit Volunteer' : 'Add Volunteer'}
              </h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeAddModal}
                aria-label="Close add volunteer modal"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={handleAddVolunteerSubmit} noValidate>
              <div className={styles.modalFields}>
                <label className={styles.fieldLabel}>
                  <span>
                    Title <span className={styles.requiredAsterisk}>*</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={addVolunteerForm.title}
                    onChange={(event) => {
                      setTitleError('')
                      setAddVolunteerForm((currentForm) => ({
                        ...currentForm,
                        title: toTitleCase(event.target.value),
                      }))
                    }}
                    className={`${styles.fieldInput}${titleError ? ` ${styles.fieldInputError}` : ''}`}
                  />
                  {titleError ? <span className={styles.fieldErrorText}>{titleError}</span> : null}
                </label>
                <label className={styles.fieldLabel}>
                  <span>
                    Start Date <span className={styles.requiredAsterisk}>*</span>
                  </span>
                  <input
                    type="date"
                    required
                    value={addVolunteerForm.startDate}
                    onChange={(event) => {
                      setStartDateError('')
                      setEndDateError('')
                      setEndTimeError('')
                      setAddVolunteerForm((currentForm) => ({
                        ...currentForm,
                        startDate: event.target.value,
                      }))
                    }}
                    className={`${styles.fieldInput}${startDateError ? ` ${styles.fieldInputError}` : ''}`}
                  />
                  {startDateError ? <span className={styles.fieldErrorText}>{startDateError}</span> : null}
                </label>
                <label className={styles.fieldLabel}>
                  <span>
                    End Date <span className={styles.requiredAsterisk}>*</span>
                  </span>
                  <input
                    type="date"
                    required
                    min={addVolunteerForm.startDate || undefined}
                    value={addVolunteerForm.endDate}
                    onChange={(event) => {
                      setEndDateError('')
                      setEndTimeError('')
                      setAddVolunteerForm((currentForm) => ({
                        ...currentForm,
                        endDate: event.target.value,
                      }))
                    }}
                    className={`${styles.fieldInput}${endDateError ? ` ${styles.fieldInputError}` : ''}`}
                  />
                  {endDateError ? <span className={styles.fieldErrorText}>{endDateError}</span> : null}
                </label>
                <label className={styles.fieldLabel}>
                  <span>
                    Start Time <span className={styles.requiredAsterisk}>*</span>
                  </span>
                  <input
                    type="time"
                    required
                    value={addVolunteerForm.startTime}
                    onChange={(event) => {
                      setStartTimeError('')
                      setEndTimeError('')
                      setAddVolunteerForm((currentForm) => ({
                        ...currentForm,
                        startTime: event.target.value,
                      }))
                    }}
                    className={`${styles.fieldInput}${startTimeError ? ` ${styles.fieldInputError}` : ''}`}
                  />
                  {startTimeError ? <span className={styles.fieldErrorText}>{startTimeError}</span> : null}
                </label>
                <label className={styles.fieldLabel}>
                  <span>
                    End Time <span className={styles.requiredAsterisk}>*</span>
                  </span>
                  <input
                    type="time"
                    required
                    value={addVolunteerForm.endTime}
                    onChange={(event) => {
                      setEndTimeError('')
                      setAddVolunteerForm((currentForm) => ({
                        ...currentForm,
                        endTime: event.target.value,
                      }))
                    }}
                    className={`${styles.fieldInput}${endTimeError ? ` ${styles.fieldInputError}` : ''}`}
                  />
                  {endTimeError ? <span className={styles.fieldErrorText}>{endTimeError}</span> : null}
                </label>
                <label className={`${styles.fieldLabel} ${styles.fieldLabelWide}`}>
                  <span>Link</span>
                  <input
                    type="url"
                    value={addVolunteerForm.link}
                    onChange={(event) => {
                      setAddVolunteerForm((currentForm) => ({
                        ...currentForm,
                        link: event.target.value,
                      }))
                    }}
                    className={styles.fieldInput}
                    placeholder="https://example.com/volunteer/..."
                  />
                </label>
                <div className={`${styles.fieldLabel} ${styles.fieldLabelWide}`}>
                  <span>
                    Volunteer Photo <span className={styles.requiredAsterisk}>*</span>
                  </span>
                  <PhotoUploadField
                    value={addVolunteerForm.photo}
                    onChange={(nextPhoto) => {
                      setPhotoError('')
                      setAddVolunteerForm((currentForm) => ({ ...currentForm, photo: nextPhoto }))
                    }}
                    onNotify={(message, variant) => showToast(message, { variant })}
                    title="Photo Upload"
                    subtitle="Upload a volunteer photo from your device or camera. Required."
                    previewAlt={
                      addVolunteerForm.title ? `${addVolunteerForm.title} photo` : 'Volunteer photo preview'
                    }
                    uploadFolder="volunteers"
                  />
                  {photoError ? <span className={styles.fieldErrorText}>{photoError}</span> : null}
                </div>
                <label className={`${styles.fieldLabel} ${styles.fieldLabelWide}`}>
                  <span>Description</span>
                  <textarea
                    value={addVolunteerForm.description}
                    onChange={(event) => {
                      setAddVolunteerForm((currentForm) => ({
                        ...currentForm,
                        description: event.target.value,
                      }))
                    }}
                    className={styles.fieldTextarea}
                    style={{ resize: 'none' }}
                    rows={3}
                  />
                </label>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.modalCancelButton} onClick={closeAddModal}>
                  Cancel
                </button>
                <button type="submit" className={styles.modalSubmitButton} disabled={isSavingVolunteer}>
                  {isSavingVolunteer ? 'Saving...' : editingVolunteerId ? 'Save' : 'Add Volunteer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={Boolean(pendingDeleteVolunteer)}
        title="Delete volunteer listing?"
        message={`Are you sure you want to delete ${pendingDeleteVolunteer?.title ?? 'this volunteer listing'}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        ariaLabel="Delete volunteer confirmation"
        isBusy={volunteerIdBeingDeleted !== null}
        onCancel={() => {
          setPendingDeleteVolunteer(null)
        }}
        onConfirm={handleDeleteVolunteerConfirm}
      />
    </MainLayout>
  )
}

export default VolunteerListPage
