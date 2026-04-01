import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FaChevronLeft, FaChevronRight, FaFilter, FaSyncAlt, FaTimes } from 'react-icons/fa'
import catAnimalIcon from '@/assets/cat-icon.png'
import dogAnimalIcon from '@/assets/dog-icon.png'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { adoptionRequestService } from '@/features/adoption-requests/services/adoption-request.service'
import type {
  AdoptionRequest,
  AdoptionRequestReviewStatus,
  AdoptionRequestStatus,
} from '@/features/adoption-requests/types/adoption-request-api'
import { STATUS_LABELS as PET_STATUS_LABELS } from '@/features/pets/constants/pet-list.constants'
import type { PetStatus } from '@/features/pets/types/pet-api'
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
import { getStringField, getUserIdFromUnknownUser } from '@/shared/lib/profile/header-profile'
import type { SidebarItemKey } from '@/shared/types/layout'
import DateMultiSelectPicker from '@/shared/components/ui/DateMultiSelectPicker/DateMultiSelectPicker'
import PillMultiSelectDropdown from '@/shared/components/ui/PillMultiSelectDropdown/PillMultiSelectDropdown'
import styles from './AdoptionRequestListPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'adoption-logs'

const REQUEST_STATUS_FILTER_OPTIONS = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const

type RequestStatusFilter = (typeof REQUEST_STATUS_FILTER_OPTIONS)[number]

const REQUEST_STATUS_FILTER_LABELS: Record<RequestStatusFilter, string> = {
  APPROVED: 'APPROVED',
  CANCELLED: 'CANCELLED',
  PENDING: 'PENDING',
  REJECTED: 'REJECTED',
}

type AdoptionLogRow = {
  createdAt?: string | null
  createdAtLabel: string
  dateKey: string
  petName: string
  petStatusLabel: string
  race: string
  requestId: string
  requestNumber: string
  requestStatus: AdoptionRequestStatus
  requesterId: string
  requesterName: string
  sortTime: number
  typeLabel: string
}

const areDateSelectionsEqual = (leftValues: string[], rightValues: string[]) => {
  if (leftValues.length !== rightValues.length) {
    return false
  }

  return leftValues.every((leftValue, index) => leftValue === rightValues[index])
}

const REQUEST_STATUS_UI: Record<
  AdoptionRequestStatus,
  {
    badgeClassName: string
    label: string
  }
> = {
  APPROVED: {
    badgeClassName: 'statusCompleted',
    label: 'Approved',
  },
  CANCELLED: {
    badgeClassName: 'statusOnHold',
    label: 'Cancelled',
  },
  PENDING: {
    badgeClassName: 'statusProcessing',
    label: 'In Progress',
  },
  REJECTED: {
    badgeClassName: 'statusCancelled',
    label: 'Rejected',
  },
}

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

const toDateKey = (value?: string | null) => {
  if (!value) {
    return ''
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return ''
  }

  const year = parsedDate.getFullYear()
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
  const day = String(parsedDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const toSortTime = (value?: string | null) => {
  if (!value) {
    return 0
  }

  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

const toRaceLabel = (race?: string | null) => {
  return race?.trim() || 'Unknown'
}

const toTypeLabel = (type?: string | null) => {
  return type?.trim() || 'Unknown'
}

const toRequestNumberLabel = (value?: string | null) => {
  const normalized = value?.trim()
  return normalized || ''
}

const toRequesterName = (requester?: AdoptionRequest['requester']) => {
  if (!requester) {
    return 'Unknown Requester'
  }

  const fullName = [requester.firstName, requester.lastName]
    .map((namePart) => namePart?.trim() || '')
    .filter(Boolean)
    .join(' ')

  if (fullName) {
    return fullName
  }

  return requester.email?.trim() || 'Unknown Requester'
}

const resolveUserRole = (user: AuthSession['user']) => {
  const rootRole = getStringField(user, ['role', 'userRole', 'userType'])
  if (rootRole) {
    return rootRole
  }

  if (!user || typeof user !== 'object') {
    return ''
  }

  const roleValue = (user as Record<string, unknown>).role
  return getStringField(roleValue, ['name', 'label', 'title'])
}

const isCatType = (type?: string) => {
  return type?.trim().toLowerCase() === 'cat'
}

const mapLogRow = (request: AdoptionRequest): AdoptionLogRow => {
  const requestPet = request.pet
  const createdAt = request.createdAt ?? request.updatedAt ?? request.reviewedAt
  const petStatus = requestPet?.status

  return {
    createdAt,
    createdAtLabel: formatDateLabel(createdAt),
    dateKey: toDateKey(createdAt),
    petName: requestPet?.name?.trim() || 'Unknown Pet',
    petStatusLabel: PET_STATUS_LABELS[petStatus as PetStatus] ?? (petStatus || 'Unknown'),
    race: toRaceLabel(requestPet?.race),
    requestId: request.id,
    requestNumber: toRequestNumberLabel(request.requestNumber),
    requestStatus: request.status,
    requesterId: request.requester?.id?.trim() || '',
    requesterName: toRequesterName(request.requester),
    sortTime: toSortTime(createdAt),
    typeLabel: toTypeLabel(requestPet?.type),
  }
}

interface AdoptionRequestListPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

function AdoptionRequestListPage({ onLogout, session }: AdoptionRequestListPageProps) {
  const { clearToast, showToast, toast } = useToast()
  const [searchValue, setSearchValue] = useState('')
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [rows, setRows] = useState<AdoptionLogRow[]>([])
  const [selectedDateKeys, setSelectedDateKeys] = useState<string[]>([])
  const [selectedRaceValues, setSelectedRaceValues] = useState<string[]>([])
  const [selectedStatusValues, setSelectedStatusValues] = useState<RequestStatusFilter[]>([])
  const [selectedRequestForStatusUpdate, setSelectedRequestForStatusUpdate] = useState<AdoptionLogRow | null>(
    null,
  )
  const [pendingDeleteRequest, setPendingDeleteRequest] = useState<AdoptionLogRow | null>(null)
  const [statusReviewNotes, setStatusReviewNotes] = useState('')
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const lastAutoLoadedTokenRef = useRef<string | null>(null)
  const resolvedHeaderProfile = useHeaderProfile({
    fallbackProfile: defaultHeaderProfile,
    session,
  })
  const accessToken = session?.accessToken?.trim() ?? ''
  const sessionUserId = getUserIdFromUnknownUser(session?.user)
  const sessionRole = resolveUserRole(session?.user).toLowerCase()
  const isAdminUser = sessionRole.includes('admin')

  const loadAdoptionLogs = useCallback(async () => {
    if (!accessToken) {
      setRows([])
      return
    }

    setIsLoadingLogs(true)

    try {
      const requests = await adoptionRequestService.list(accessToken, {
        ignorePagination: true,
        sortBy: 'createdAt',
        sortDir: 'desc',
      })

      const nextRows = requests.map(mapLogRow)
      const sortedRows = [...nextRows].sort((leftRow, rightRow) => rightRow.sortTime - leftRow.sortTime)
      setRows(sortedRows)
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsLoadingLogs(false)
    }
  }, [accessToken, showToast])

  useEffect(() => {
    clearToast()

    if (!accessToken) {
      lastAutoLoadedTokenRef.current = null
      setRows([])
      return
    }

    if (lastAutoLoadedTokenRef.current === accessToken) {
      return
    }

    lastAutoLoadedTokenRef.current = accessToken
    void loadAdoptionLogs()
  }, [accessToken, clearToast, loadAdoptionLogs])

  const dateOptions = useMemo(() => {
    const uniqueDateKeys = Array.from(
      new Set(
        rows
          .map((row) => row.dateKey)
          .filter(Boolean),
      ),
    ).sort((left, right) => right.localeCompare(left))

    return uniqueDateKeys.map((dateKey) => ({
      label: formatDateLabel(dateKey),
      value: dateKey,
    }))
  }, [rows])

  useEffect(() => {
    if (!dateOptions.length) {
      return
    }

    setSelectedDateKeys((currentDateKeys) => {
      if (currentDateKeys.length > 0) {
        return currentDateKeys
      }

      return [dateOptions[0].value]
    })
  }, [dateOptions])

  const raceOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.race))).sort((left, right) =>
      left.localeCompare(right),
    )
  }, [rows])

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()

    return rows.filter((row) => {
      if (selectedDateKeys.length > 0 && !selectedDateKeys.includes(row.dateKey)) {
        return false
      }

      if (selectedRaceValues.length > 0 && !selectedRaceValues.includes(row.race)) {
        return false
      }

      if (selectedStatusValues.length > 0 && !selectedStatusValues.includes(row.requestStatus)) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      return (
        row.petName.toLowerCase().includes(normalizedSearch) ||
        row.race.toLowerCase().includes(normalizedSearch) ||
        row.typeLabel.toLowerCase().includes(normalizedSearch) ||
        row.petStatusLabel.toLowerCase().includes(normalizedSearch) ||
        row.requestStatus.toLowerCase().includes(normalizedSearch) ||
        REQUEST_STATUS_UI[row.requestStatus].label.toLowerCase().includes(normalizedSearch)
      )
    })
  }, [rows, searchValue, selectedDateKeys, selectedRaceValues, selectedStatusValues])

  const primarySelectedDateKey = selectedDateKeys[0] || ''

  const selectedDateIndex = useMemo(() => {
    if (!primarySelectedDateKey) {
      return -1
    }

    return dateOptions.findIndex((option) => option.value === primarySelectedDateKey)
  }, [dateOptions, primarySelectedDateKey])

  const hasPrevDate = selectedDateIndex >= 0 && selectedDateIndex < dateOptions.length - 1
  const hasNextDate = selectedDateIndex > 0

  const applyDateSelection = useCallback(
    (nextDateKeys: string[]) => {
      const normalizedDateKeys = [...nextDateKeys].sort((left, right) => right.localeCompare(left))
      if (areDateSelectionsEqual(normalizedDateKeys, selectedDateKeys)) {
        return
      }

      setSelectedDateKeys(normalizedDateKeys)
    },
    [selectedDateKeys],
  )

  const handlePrevDate = () => {
    if (!hasPrevDate) {
      return
    }

    const nextDateOption = dateOptions[selectedDateIndex + 1]
    if (!nextDateOption) {
      return
    }

    applyDateSelection([nextDateOption.value])
  }

  const handleNextDate = () => {
    if (!hasNextDate) {
      return
    }

    const nextDateOption = dateOptions[selectedDateIndex - 1]
    if (!nextDateOption) {
      return
    }

    applyDateSelection([nextDateOption.value])
  }

  const handleResetFilters = () => {
    setSelectedRaceValues([])
    setSelectedStatusValues([])
    const resetDateKeys = dateOptions[0] ? [dateOptions[0].value] : []
    applyDateSelection(resetDateKeys)
  }

  const getAllowedStatusUpdates = useCallback(
    (row: AdoptionLogRow): ReadonlyArray<AdoptionRequestReviewStatus> => {
      if (row.requestStatus !== 'PENDING') {
        return []
      }

      const allowedStatuses: AdoptionRequestReviewStatus[] = []

      if (isAdminUser) {
        allowedStatuses.push('APPROVED', 'REJECTED')
      }

      if (sessionUserId && row.requesterId === sessionUserId) {
        allowedStatuses.push('CANCELLED')
      }

      return allowedStatuses
    },
    [isAdminUser, sessionUserId],
  )

  const selectedAllowedStatuses = useMemo(() => {
    if (!selectedRequestForStatusUpdate) {
      return []
    }

    return getAllowedStatusUpdates(selectedRequestForStatusUpdate)
  }, [getAllowedStatusUpdates, selectedRequestForStatusUpdate])

  const closeStatusModal = () => {
    if (isUpdatingStatus) {
      return
    }

    setSelectedRequestForStatusUpdate(null)
    setStatusReviewNotes('')
  }

  const handleOpenStatusModal = (row: AdoptionLogRow) => {
    setSelectedRequestForStatusUpdate(row)
    setStatusReviewNotes('')
  }

  const handleUpdateStatus = (status: AdoptionRequestReviewStatus) => {
    if (!selectedRequestForStatusUpdate) {
      return
    }

    if (!accessToken) {
      showToast('You need to sign in before updating an adoption request.', { variant: 'error' })
      return
    }

    if (!sessionUserId) {
      showToast('Unable to resolve your account ID for this session.', { variant: 'error' })
      return
    }

    if (!selectedAllowedStatuses.includes(status)) {
      showToast('You do not have permission to apply the selected status.', { variant: 'error' })
      return
    }

    const updateRequestStatus = async () => {
      setIsUpdatingStatus(true)

      try {
        await adoptionRequestService.updateStatus(
          selectedRequestForStatusUpdate.requestId,
          {
            reviewNotes: statusReviewNotes.trim() || undefined,
            status,
          },
          accessToken,
          sessionUserId,
        )

        setSelectedRequestForStatusUpdate(null)
        setStatusReviewNotes('')
        showToast('Adoption request status updated successfully.', { variant: 'success' })
        await loadAdoptionLogs()
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setIsUpdatingStatus(false)
      }
    }

    void updateRequestStatus()
  }

  const handleDeleteFromListConfirm = () => {
    if (!pendingDeleteRequest) {
      return
    }

    const requestId = pendingDeleteRequest.requestId
    setRows((currentRows) => currentRows.filter((row) => row.requestId !== requestId))
    setPendingDeleteRequest(null)
    if (selectedRequestForStatusUpdate?.requestId === requestId) {
      closeStatusModal()
    }
    showToast('Adoption request removed from this list view.', { variant: 'success' })
  }

  const canApproveSelected = selectedAllowedStatuses.includes('APPROVED')
  const canRejectSelected = selectedAllowedStatuses.includes('REJECTED')
  const canCancelSelected = selectedAllowedStatuses.includes('CANCELLED')
  const showDeleteSelected =
    selectedRequestForStatusUpdate?.requestStatus === 'PENDING' ||
    selectedRequestForStatusUpdate?.requestStatus === 'CANCELLED'

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
          <h1 className={styles.pageTitle}>Adoptation Logs</h1>

          <div className={styles.filterBar}>
            <div className={`${styles.filterCell} ${styles.filterByCell}`}>
              <FaFilter aria-hidden="true" />
              <span>Filter By</span>
            </div>

            <div className={`${styles.filterCell} ${styles.dateFilterCell}`}>
              <DateMultiSelectPicker
                availableDateKeys={dateOptions.map((option) => option.value)}
                selectedDateKeys={selectedDateKeys}
                onApply={applyDateSelection}
              />
            </div>

            <label className={styles.filterCell}>
              <PillMultiSelectDropdown
                options={raceOptions.map((raceOption) => ({ label: raceOption, value: raceOption }))}
                selectedValues={selectedRaceValues}
                placeholder="Race Type"
                panelTitle="Select Race Type"
                helperText="*You can choose multiple Race Type"
                onApply={(values) => {
                  setSelectedRaceValues(values)
                }}
              />
            </label>

            <label className={styles.filterCell}>
              <PillMultiSelectDropdown
                options={REQUEST_STATUS_FILTER_OPTIONS.map((statusOption) => ({
                  label: REQUEST_STATUS_FILTER_LABELS[statusOption],
                  value: statusOption,
                }))}
                selectedValues={selectedStatusValues}
                placeholder="Request Status"
                panelTitle="Select Request Status"
                helperText="*You can choose multiple request statuses"
                panelAlign="right"
                onApply={(values) => {
                  setSelectedStatusValues(values as RequestStatusFilter[])
                }}
              />
            </label>

            <button type="button" className={styles.resetButton} onClick={handleResetFilters}>
              <FaSyncAlt aria-hidden="true" />
              <span>Reset Filter</span>
            </button>
          </div>

          <div className={styles.tablePanel}>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Number</th>
                    <th scope="col">Pet Name</th>
                    <th scope="col">Race</th>
                    <th scope="col">Date</th>
                    <th scope="col">Type</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingLogs ? (
                    Array.from({ length: 8 }, (_, rowIndex) => (
                      <tr key={`adoption-log-skeleton-${rowIndex}`} aria-hidden="true">
                        <td colSpan={6}>
                          <div className={styles.rowSkeleton} />
                        </td>
                      </tr>
                    ))
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={styles.emptyStateCell}>
                        No adoption logs found.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, rowIndex) => {
                      const typeIsCat = isCatType(row.typeLabel)
                      const statusUi = REQUEST_STATUS_UI[row.requestStatus]

                      return (
                        <tr
                          key={row.requestId}
                          className={styles.clickableRow}
                          onClick={() => {
                            handleOpenStatusModal(row)
                          }}
                        >
                          <td>{row.requestNumber || String(rowIndex + 1).padStart(6, '0')}</td>
                          <td>{row.petName}</td>
                          <td>{row.race}</td>
                          <td>{row.createdAtLabel}</td>
                          <td>
                            <span className={styles.typeBadge} title={row.typeLabel}>
                              <img
                                src={typeIsCat ? catAnimalIcon : dogAnimalIcon}
                                alt={row.typeLabel}
                                className={styles.typeIcon}
                              />
                            </span>
                          </td>
                          <td>
                            <span className={`${styles.statusBadge} ${styles[statusUi.badgeClassName]}`}>
                              {statusUi.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <footer className={styles.footerNav}>
            <button
              type="button"
              className={styles.dateNavButton}
              onClick={handlePrevDate}
              disabled={!hasPrevDate}
            >
              <FaChevronLeft aria-hidden="true" />
              <span>Prev. Date</span>
            </button>

            <button
              type="button"
              className={styles.dateNavButton}
              onClick={handleNextDate}
              disabled={!hasNextDate}
            >
              <span>Next Date</span>
              <FaChevronRight aria-hidden="true" />
            </button>
          </footer>
        </section>
      </div>

      {selectedRequestForStatusUpdate ? (
        <div
          className={styles.modalOverlay}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeStatusModal()
            }
          }}
        >
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="adoption-request-status-modal-title"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className={styles.modalHeader}>
              <h2 id="adoption-request-status-modal-title" className={styles.modalTitle}>
                Change Adoption Request Status
              </h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeStatusModal}
                aria-label="Close adoption request status modal"
                disabled={isUpdatingStatus}
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className={styles.modalForm}>
              <div className={styles.modalFields}>
                <div className={styles.modalMeta}>
                  <span className={styles.modalMetaLabel}>Request</span>
                  <span className={styles.modalMetaValue}>
                    #{selectedRequestForStatusUpdate.requestNumber || selectedRequestForStatusUpdate.requestId}
                  </span>
                </div>

                <div className={styles.modalMeta}>
                  <span className={styles.modalMetaLabel}>Pet</span>
                  <span className={styles.modalMetaValue}>{selectedRequestForStatusUpdate.petName}</span>
                </div>

                <div className={styles.modalMeta}>
                  <span className={styles.modalMetaLabel}>Requester</span>
                  <span className={styles.modalMetaValue}>{selectedRequestForStatusUpdate.requesterName}</span>
                </div>

                <label className={styles.fieldLabel}>
                  <span>Current Status</span>
                  <input
                    type="text"
                    className={styles.fieldInput}
                    value={`${selectedRequestForStatusUpdate.requestStatus} (${REQUEST_STATUS_UI[selectedRequestForStatusUpdate.requestStatus].label})`}
                    readOnly
                  />
                </label>

                <label className={styles.fieldLabel}>
                  <span>Review Notes (Optional)</span>
                  <textarea
                    value={statusReviewNotes}
                    onChange={(event) => {
                      setStatusReviewNotes(event.target.value)
                    }}
                    className={styles.fieldTextarea}
                    rows={4}
                    maxLength={1000}
                    disabled={isUpdatingStatus}
                    placeholder="Enter review notes for this status update."
                  />
                </label>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={`${styles.modalActionButton} ${styles.modalCloseActionButton}`}
                  onClick={closeStatusModal}
                  disabled={isUpdatingStatus}
                >
                  Close
                </button>

                <button
                  type="button"
                  className={`${styles.modalActionButton} ${styles.modalApproveButton}`}
                  onClick={() => {
                    handleUpdateStatus('APPROVED')
                  }}
                  disabled={isUpdatingStatus || !canApproveSelected}
                >
                  Approve
                </button>

                <button
                  type="button"
                  className={`${styles.modalActionButton} ${styles.modalRejectButton}`}
                  onClick={() => {
                    handleUpdateStatus('REJECTED')
                  }}
                  disabled={isUpdatingStatus || !canRejectSelected}
                >
                  Reject
                </button>

                <button
                  type="button"
                  className={`${styles.modalActionButton} ${styles.modalCancelRequestButton}`}
                  onClick={() => {
                    handleUpdateStatus('CANCELLED')
                  }}
                  disabled={isUpdatingStatus || !canCancelSelected}
                >
                  Cancel Request
                </button>

                {showDeleteSelected ? (
                  <button
                    type="button"
                    className={`${styles.modalActionButton} ${styles.modalDeleteButton}`}
                    onClick={() => {
                      setPendingDeleteRequest(selectedRequestForStatusUpdate)
                    }}
                    disabled={isUpdatingStatus}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={Boolean(pendingDeleteRequest)}
        title="Delete adoption request from list?"
        message={`Remove request #${pendingDeleteRequest?.requestNumber || pendingDeleteRequest?.requestId || ''} from this list view?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        ariaLabel="Delete adoption request from list confirmation"
        isBusy={isUpdatingStatus}
        onCancel={() => {
          setPendingDeleteRequest(null)
        }}
        onConfirm={handleDeleteFromListConfirm}
      />
    </MainLayout>
  )
}

export default AdoptionRequestListPage
