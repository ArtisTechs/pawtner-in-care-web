import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { FaEdit, FaPlus, FaTimes, FaTrashAlt } from 'react-icons/fa'
import donationFallbackImage from '@/assets/donate-front-page-icon.png'
import type { AuthSession } from '@/features/auth/types/auth-api'
import {
  DEFAULT_ADD_DONATION_CAMPAIGN_FORM,
  DEFAULT_CAMPAIGN_TYPES,
  LIST_BATCH_SIZE,
  LIST_INITIAL_BATCH_SIZE,
  LIST_SKELETON_ROW_COUNT,
  STATUS_LABELS,
  TYPE_LABELS,
  type AddDonationCampaignForm,
} from '@/features/donation-campaigns/constants/donation-campaign-list.constants'
import { donationCampaignService } from '@/features/donation-campaigns/services/donation-campaign.service'
import type {
  DonationCampaign,
  DonationCampaignType,
} from '@/features/donation-campaigns/types/donation-campaign-api'
import {
  buildDonationCampaignPayload,
  formatCurrency,
  formatDateLabel,
  isDeadlineBeforeStartDate,
  mapDonationCampaignToForm,
} from '@/features/donation-campaigns/utils/donation-campaign-form'
import { defaultHeaderProfile, sidebarBottomItems, sidebarLogo, sidebarMenuItems } from '@/layouts/config/navigation'
import Header from '@/layouts/Header/Header'
import MainLayout from '@/layouts/MainLayout/MainLayout'
import Sidebar from '@/layouts/Sidebar/Sidebar'
import { getErrorMessage } from '@/shared/api/api-error'
import Toast from '@/shared/components/feedback/Toast'
import PhotoUploadField from '@/shared/components/media/PhotoUploadField/PhotoUploadField'
import ConfirmModal from '@/shared/components/ui/ConfirmModal/ConfirmModal'
import StatusBadge, { type StatusBadgeTone } from '@/shared/components/ui/StatusBadge/StatusBadge'
import { useHeaderProfile } from '@/shared/hooks/useHeaderProfile'
import { useResponsiveSidebar } from '@/shared/hooks/useResponsiveSidebar'
import { useToast } from '@/shared/hooks/useToast'
import type { SidebarItemKey } from '@/shared/types/layout'
import styles from './DonationCampaignListPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'donation-campaign-list'

interface DonationCampaignListPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

type CampaignFormErrorKey = 'title' | 'totalCost' | 'startDate' | 'deadline' | 'photo'

type CampaignFormErrors = Record<CampaignFormErrorKey, string>
const REQUIRED_FIELDS_ERROR_MESSAGE = 'Please complete all required fields.'

const createEmptyCampaignFormErrors = (): CampaignFormErrors => ({
  deadline: '',
  photo: '',
  startDate: '',
  title: '',
  totalCost: '',
})

const toTitleCase = (value: string) =>
  value
    .split(/(\s+)/)
    .map((segment) => {
      if (!segment.trim()) {
        return segment
      }

      return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
    })
    .join('')

const STATUS_TONE_BY_CAMPAIGN: Record<DonationCampaign['status'], StatusBadgeTone> = {
  CANCELLED: 'danger',
  COMPLETED: 'positive',
  ONGOING: 'info',
}

const resolveCampaignImage = (campaign: DonationCampaign) => {
  if (campaign.photo) {
    return campaign.photo
  }

  return donationFallbackImage
}

function DonationCampaignListPage({ onLogout, session }: DonationCampaignListPageProps) {
  const { clearToast, showToast, toast } = useToast()
  const [searchValue, setSearchValue] = useState('')
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const resolvedHeaderProfile = useHeaderProfile({
    fallbackProfile: defaultHeaderProfile,
    session,
  })
  const [campaigns, setCampaigns] = useState<DonationCampaign[]>([])
  const [campaignTypes, setCampaignTypes] = useState<DonationCampaignType[]>(DEFAULT_CAMPAIGN_TYPES)
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [viewingCampaign, setViewingCampaign] = useState<DonationCampaign | null>(null)
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null)
  const [isSavingCampaign, setIsSavingCampaign] = useState(false)
  const [campaignIdBeingDeleted, setCampaignIdBeingDeleted] = useState<string | null>(null)
  const [pendingDeleteCampaign, setPendingDeleteCampaign] = useState<{ id: string; title: string } | null>(
    null,
  )
  const [addCampaignForm, setAddCampaignForm] = useState<AddDonationCampaignForm>(
    DEFAULT_ADD_DONATION_CAMPAIGN_FORM,
  )
  const [campaignFormErrors, setCampaignFormErrors] = useState<CampaignFormErrors>(
    createEmptyCampaignFormErrors,
  )
  const [visibleCampaignCount, setVisibleCampaignCount] = useState(LIST_INITIAL_BATCH_SIZE)
  const tableScrollRef = useRef<HTMLDivElement | null>(null)
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null)
  const accessToken = session?.accessToken?.trim() ?? ''
  const clearCampaignFormError = useCallback((field: CampaignFormErrorKey) => {
    setCampaignFormErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors
      }

      return {
        ...currentErrors,
        [field]: '',
      }
    })
  }, [])

  const loadCampaigns = useCallback(async () => {
    if (!accessToken) {
      setCampaigns([])
      return
    }

    setIsLoadingCampaigns(true)

    try {
      const campaignList = await donationCampaignService.list(accessToken)
      setCampaigns(Array.isArray(campaignList) ? campaignList : [])
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsLoadingCampaigns(false)
    }
  }, [accessToken, showToast])

  const loadCampaignTypes = useCallback(async () => {
    if (!accessToken) {
      setCampaignTypes(DEFAULT_CAMPAIGN_TYPES)
      return
    }

    try {
      const typeList = await donationCampaignService.getTypes(accessToken)
      if (Array.isArray(typeList) && typeList.length > 0) {
        setCampaignTypes(typeList)
      } else {
        setCampaignTypes(DEFAULT_CAMPAIGN_TYPES)
      }
    } catch {
      setCampaignTypes(DEFAULT_CAMPAIGN_TYPES)
    }
  }, [accessToken])

  useEffect(() => {
    clearToast()
    void loadCampaigns()
    void loadCampaignTypes()
  }, [clearToast, loadCampaigns, loadCampaignTypes])

  const filteredCampaigns = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()

    if (!normalizedSearch) {
      return campaigns
    }

    return campaigns.filter((campaign) => {
      const normalizedTitle = campaign.title?.toLowerCase() ?? ''
      const normalizedType = campaign.type?.toLowerCase() ?? ''
      const normalizedStatus = campaign.status?.toLowerCase() ?? ''

      return (
        normalizedTitle.includes(normalizedSearch) ||
        normalizedType.includes(normalizedSearch) ||
        normalizedStatus.includes(normalizedSearch)
      )
    })
  }, [campaigns, searchValue])

  useEffect(() => {
    setVisibleCampaignCount(LIST_INITIAL_BATCH_SIZE)
  }, [filteredCampaigns])

  const visibleCampaigns = useMemo(
    () => filteredCampaigns.slice(0, visibleCampaignCount),
    [filteredCampaigns, visibleCampaignCount],
  )
  const hasMoreCampaignsToReveal = visibleCampaigns.length < filteredCampaigns.length
  const skeletonRowIndexes = useMemo(
    () => Array.from({ length: LIST_SKELETON_ROW_COUNT }, (_, index) => index),
    [],
  )

  useEffect(() => {
    const scrollContainer = tableScrollRef.current
    const triggerElement = loadMoreTriggerRef.current

    if (!scrollContainer || !triggerElement || isLoadingCampaigns || !hasMoreCampaignsToReveal) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (!entry?.isIntersecting) {
          return
        }

        setVisibleCampaignCount((currentCount) =>
          Math.min(currentCount + LIST_BATCH_SIZE, filteredCampaigns.length),
        )
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
  }, [filteredCampaigns.length, hasMoreCampaignsToReveal, isLoadingCampaigns])

  const closeAddModal = useCallback(() => {
    setIsAddModalOpen(false)
    setEditingCampaignId(null)
    setAddCampaignForm(DEFAULT_ADD_DONATION_CAMPAIGN_FORM)
    setCampaignFormErrors(createEmptyCampaignFormErrors())
  }, [])

  const closeViewModal = useCallback(() => {
    setViewingCampaign(null)
  }, [])

  const handleAddCampaignSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!accessToken) {
      showToast('You need to sign in before managing donation campaigns.', { variant: 'error' })
      return
    }

    const persistCampaign = async () => {
      const trimmedTitle = addCampaignForm.title.trim()
      const trimmedCost = addCampaignForm.totalCost.trim()
      const trimmedStartDate = addCampaignForm.startDate.trim()
      const trimmedDeadline = addCampaignForm.deadline.trim()
      const trimmedPhoto = addCampaignForm.photo.trim()
      const nextFormErrors: CampaignFormErrors = {
        deadline: trimmedDeadline ? '' : REQUIRED_FIELDS_ERROR_MESSAGE,
        photo: trimmedPhoto ? '' : REQUIRED_FIELDS_ERROR_MESSAGE,
        startDate: trimmedStartDate ? '' : REQUIRED_FIELDS_ERROR_MESSAGE,
        title: trimmedTitle ? '' : REQUIRED_FIELDS_ERROR_MESSAGE,
        totalCost: trimmedCost ? '' : REQUIRED_FIELDS_ERROR_MESSAGE,
      }

      if (Object.values(nextFormErrors).some(Boolean) || !addCampaignForm.status || !addCampaignForm.type) {
        setCampaignFormErrors(nextFormErrors)
        showToast(REQUIRED_FIELDS_ERROR_MESSAGE, { variant: 'error' })
        return
      }

      if (isDeadlineBeforeStartDate(addCampaignForm.startDate, addCampaignForm.deadline)) {
        setCampaignFormErrors((currentErrors) => ({
          ...currentErrors,
          deadline: 'Deadline cannot be earlier than start date.',
        }))
        showToast('Deadline cannot be earlier than start date.', { variant: 'error' })
        return
      }

      setCampaignFormErrors(createEmptyCampaignFormErrors())
      const payload = buildDonationCampaignPayload(addCampaignForm)
      if (!payload) {
        setCampaignFormErrors((currentErrors) => ({
          ...currentErrors,
          totalCost: 'Please enter a valid total cost.',
        }))
        showToast('Please enter a valid total cost.', { variant: 'error' })
        return
      }

      setIsSavingCampaign(true)

      try {
        if (editingCampaignId) {
          await donationCampaignService.update(editingCampaignId, payload, accessToken)
          showToast('Donation campaign updated successfully.', { variant: 'success' })
        } else {
          await donationCampaignService.create(payload, accessToken)
          showToast('Donation campaign added successfully.', { variant: 'success' })
        }

        closeAddModal()
        await loadCampaigns()
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setIsSavingCampaign(false)
      }
    }

    void persistCampaign()
  }

  const handleEditCampaign = (campaign: DonationCampaign) => {
    setEditingCampaignId(campaign.id)
    setAddCampaignForm(mapDonationCampaignToForm(campaign))
    setCampaignFormErrors(createEmptyCampaignFormErrors())
    setIsAddModalOpen(true)
  }

  const handleViewCampaign = (campaign: DonationCampaign) => {
    setViewingCampaign(campaign)
  }

  const handleDeleteCampaign = (campaignId: string) => {
    if (!accessToken) {
      setPendingDeleteCampaign(null)
      showToast('You need to sign in before managing donation campaigns.', { variant: 'error' })
      return
    }

    const deleteCampaign = async () => {
      setCampaignIdBeingDeleted(campaignId)

      try {
        await donationCampaignService.delete(campaignId, accessToken)
        setCampaigns((currentCampaigns) =>
          currentCampaigns.filter((campaign) => campaign.id !== campaignId),
        )
        setViewingCampaign((currentCampaign) =>
          currentCampaign?.id === campaignId ? null : currentCampaign,
        )
        showToast('Donation campaign removed successfully.', { variant: 'success' })
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setPendingDeleteCampaign(null)
        setCampaignIdBeingDeleted(null)
      }
    }

    void deleteCampaign()
  }

  const handleDeleteCampaignRequest = (campaign: DonationCampaign) => {
    setPendingDeleteCampaign({
      id: campaign.id,
      title: campaign.title?.trim() || 'this campaign',
    })
  }

  const handleDeleteCampaignConfirm = () => {
    if (!pendingDeleteCampaign) {
      return
    }

    const campaignId = pendingDeleteCampaign.id
    handleDeleteCampaign(campaignId)
  }

  const handleViewEdit = () => {
    if (!viewingCampaign) {
      return
    }

    const nextCampaignToEdit = viewingCampaign
    closeViewModal()
    handleEditCampaign(nextCampaignToEdit)
  }

  const handleViewDelete = () => {
    if (!viewingCampaign) {
      return
    }

    handleDeleteCampaignRequest(viewingCampaign)
    closeViewModal()
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
          <h1 className={styles.pageTitle}>Donation List</h1>

          <div className={styles.tablePanel}>
            <div className={styles.tableScroll} ref={tableScrollRef}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Image</th>
                    <th scope="col">Campaign</th>
                    <th scope="col">Type</th>
                    <th scope="col">Goal</th>
                    <th scope="col">Raised</th>
                    <th scope="col">Deadline</th>
                    <th scope="col">Status</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {isLoadingCampaigns ? (
                    skeletonRowIndexes.map((rowIndex) => (
                      <tr key={`campaign-skeleton-${rowIndex}`} aria-hidden="true">
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonImage}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonTextWide}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonText}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonTextWide}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonTextWide}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonTextWide}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonBadge}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonAction}`} />
                        </td>
                      </tr>
                    ))
                  ) : filteredCampaigns.length === 0 ? (
                    <tr>
                      <td colSpan={8} className={styles.tableStateCell}>
                        No donation campaigns found.
                      </td>
                    </tr>
                  ) : (
                    visibleCampaigns.map((campaign) => (
                      <tr
                        key={campaign.id}
                        className={styles.clickableRow}
                        onClick={() => {
                          handleViewCampaign(campaign)
                        }}
                      >
                        <td>
                          <img
                            src={resolveCampaignImage(campaign)}
                            alt={campaign.title || 'Donation campaign'}
                            className={styles.campaignImage}
                          />
                        </td>
                        <td>
                          <div className={styles.campaignTitleWrap}>
                            <p className={styles.campaignTitle}>{campaign.title}</p>
                            {campaign.isUrgent ? <span className={styles.urgentBadge}>Urgent</span> : null}
                          </div>
                        </td>
                        <td>{TYPE_LABELS[campaign.type] ?? campaign.type}</td>
                        <td>{formatCurrency(campaign.totalCost)}</td>
                        <td>{formatCurrency(campaign.totalDonatedCost)}</td>
                        <td>{formatDateLabel(campaign.deadline)}</td>
                        <td>
                          <StatusBadge
                            label={STATUS_LABELS[campaign.status] ?? campaign.status}
                            tone={STATUS_TONE_BY_CAMPAIGN[campaign.status]}
                          />
                        </td>
                        <td>
                          <div className={styles.actionCell}>
                            <button
                              type="button"
                              className={styles.actionButton}
                              aria-label={`Edit ${campaign.title}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleEditCampaign(campaign)
                              }}
                            >
                              <FaEdit aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className={`${styles.actionButton} ${styles.deleteButton}`}
                              aria-label={`Delete ${campaign.title}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleDeleteCampaignRequest(campaign)
                              }}
                              disabled={campaignIdBeingDeleted === campaign.id}
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

              {hasMoreCampaignsToReveal ? (
                <div ref={loadMoreTriggerRef} className={styles.loadMoreTrigger} />
              ) : null}
            </div>

              <button
                type="button"
                className={styles.floatingAddButton}
                aria-label="Add donation campaign"
                onClick={() => {
                  setEditingCampaignId(null)
                  setAddCampaignForm(DEFAULT_ADD_DONATION_CAMPAIGN_FORM)
                  setCampaignFormErrors(createEmptyCampaignFormErrors())
                  setIsAddModalOpen(true)
                }}
              >
              <span className={styles.floatingAddIcon}>
                <FaPlus aria-hidden="true" />
              </span>
              <span className={styles.floatingAddLabel}>Add Donation</span>
            </button>
          </div>

          <footer className={styles.tableFooter}>
            <span className={styles.footerText}>
              Showing {visibleCampaigns.length} of {filteredCampaigns.length}
            </span>
          </footer>
        </section>
      </div>

      {viewingCampaign ? (
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
            aria-labelledby="view-donation-campaign-modal-title"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className={styles.modalHeader}>
              <h2 id="view-donation-campaign-modal-title" className={styles.modalTitle}>
                Donation Campaign Details
              </h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => {
                  closeViewModal()
                }}
                aria-label="Close donation campaign details modal"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className={styles.viewModalBody}>
              <div className={styles.viewMedia}>
                <img
                  src={resolveCampaignImage(viewingCampaign)}
                  alt={viewingCampaign.title || 'Donation campaign'}
                  className={styles.viewImage}
                />
              </div>

              <div className={styles.viewDetailsGrid}>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Title</span>
                  <span className={styles.viewDetailValue}>{viewingCampaign.title || 'N/A'}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Type</span>
                  <span className={styles.viewDetailValue}>
                    {TYPE_LABELS[viewingCampaign.type] ?? viewingCampaign.type}
                  </span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Status</span>
                  <span className={styles.viewDetailValue}>
                    {STATUS_LABELS[viewingCampaign.status] ?? viewingCampaign.status}
                  </span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Goal</span>
                  <span className={styles.viewDetailValue}>{formatCurrency(viewingCampaign.totalCost)}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Raised</span>
                  <span className={styles.viewDetailValue}>
                    {formatCurrency(viewingCampaign.totalDonatedCost)}
                  </span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Remaining</span>
                  <span className={styles.viewDetailValue}>
                    {formatCurrency(
                      Math.max(
                        0,
                        (viewingCampaign.totalCost ?? 0) - (viewingCampaign.totalDonatedCost ?? 0),
                      ),
                    )}
                  </span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Urgent</span>
                  <span className={styles.viewDetailValue}>{viewingCampaign.isUrgent ? 'Yes' : 'No'}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Start Date</span>
                  <span className={styles.viewDetailValue}>{formatDateLabel(viewingCampaign.startDate)}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Deadline</span>
                  <span className={styles.viewDetailValue}>{formatDateLabel(viewingCampaign.deadline)}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Created Date</span>
                  <span className={styles.viewDetailValue}>
                    {formatDateLabel(viewingCampaign.createdDate)}
                  </span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Updated Date</span>
                  <span className={styles.viewDetailValue}>
                    {formatDateLabel(viewingCampaign.updatedDate)}
                  </span>
                </div>
                <div className={`${styles.viewDetailItem} ${styles.viewDetailItemWide}`}>
                  <span className={styles.viewDetailLabel}>Description</span>
                  <p className={styles.viewDescription}>{viewingCampaign.description || 'N/A'}</p>
                </div>
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
                Edit
              </button>
              <button
                type="button"
                className={`${styles.modalSubmitButton} ${styles.viewDeleteButton}`}
                onClick={() => {
                  handleViewDelete()
                }}
              >
                Delete
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
            aria-labelledby="add-donation-campaign-modal-title"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className={styles.modalHeader}>
              <h2 id="add-donation-campaign-modal-title" className={styles.modalTitle}>
                {editingCampaignId ? 'Edit Donation Campaign' : 'Add Donation Campaign'}
              </h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => {
                  closeAddModal()
                }}
                aria-label="Close donation campaign modal"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={handleAddCampaignSubmit} noValidate>
              <div className={styles.modalFields}>
                <label className={styles.fieldLabel}>
                  <span>Title</span>
                  <input
                    type="text"
                    value={addCampaignForm.title}
                    onChange={(event) => {
                      clearCampaignFormError('title')
                      const normalizedTitle = toTitleCase(event.target.value)
                      setAddCampaignForm((currentForm) => ({
                        ...currentForm,
                        title: normalizedTitle,
                      }))
                    }}
                    className={`${styles.fieldInput}${campaignFormErrors.title ? ` ${styles.fieldInputError}` : ''}`}
                  />
                  {campaignFormErrors.title ? <span className={styles.fieldErrorText}>{campaignFormErrors.title}</span> : null}
                </label>

                <label className={styles.fieldLabel}>
                  <span>Type</span>
                  <select
                    value={addCampaignForm.type}
                    onChange={(event) => {
                      setAddCampaignForm((currentForm) => ({
                        ...currentForm,
                        type: event.target.value as DonationCampaignType,
                      }))
                    }}
                    className={styles.fieldInput}
                  >
                    {campaignTypes.map((typeValue) => (
                      <option key={typeValue} value={typeValue}>
                        {TYPE_LABELS[typeValue] ?? typeValue}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.fieldLabel}>
                  <span>Total Cost (PHP)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={addCampaignForm.totalCost}
                    onChange={(event) => {
                      clearCampaignFormError('totalCost')
                      setAddCampaignForm((currentForm) => ({
                        ...currentForm,
                        totalCost: event.target.value,
                      }))
                    }}
                    className={`${styles.fieldInput}${campaignFormErrors.totalCost ? ` ${styles.fieldInputError}` : ''}`}
                    placeholder="e.g. 25000.00"
                  />
                  {campaignFormErrors.totalCost ? (
                    <span className={styles.fieldErrorText}>{campaignFormErrors.totalCost}</span>
                  ) : null}
                </label>

                <label className={styles.fieldLabel}>
                  <span>Status</span>
                  <select
                    value={addCampaignForm.status}
                    onChange={(event) => {
                      setAddCampaignForm((currentForm) => ({
                        ...currentForm,
                        status: event.target.value as AddDonationCampaignForm['status'],
                      }))
                    }}
                    className={styles.fieldInput}
                  >
                    <option value="ONGOING">{STATUS_LABELS.ONGOING}</option>
                    <option value="COMPLETED">{STATUS_LABELS.COMPLETED}</option>
                    <option value="CANCELLED">{STATUS_LABELS.CANCELLED}</option>
                  </select>
                </label>

                <label className={styles.fieldLabel}>
                  <span>Start Date</span>
                  <input
                    type="date"
                    value={addCampaignForm.startDate}
                    onChange={(event) => {
                      clearCampaignFormError('startDate')
                      const nextStartDate = event.target.value
                      setAddCampaignForm((currentForm) => ({
                        ...currentForm,
                        deadline:
                          currentForm.deadline && currentForm.deadline < nextStartDate
                            ? ''
                            : currentForm.deadline,
                        startDate: nextStartDate,
                      }))
                    }}
                    className={`${styles.fieldInput}${campaignFormErrors.startDate ? ` ${styles.fieldInputError}` : ''}`}
                  />
                  {campaignFormErrors.startDate ? (
                    <span className={styles.fieldErrorText}>{campaignFormErrors.startDate}</span>
                  ) : null}
                </label>

                <label className={styles.fieldLabel}>
                  <span>Deadline</span>
                  <input
                    type="date"
                    min={addCampaignForm.startDate || undefined}
                    value={addCampaignForm.deadline}
                    onChange={(event) => {
                      clearCampaignFormError('deadline')
                      setAddCampaignForm((currentForm) => ({
                        ...currentForm,
                        deadline: event.target.value,
                      }))
                    }}
                    className={`${styles.fieldInput}${campaignFormErrors.deadline ? ` ${styles.fieldInputError}` : ''}`}
                  />
                  {campaignFormErrors.deadline ? (
                    <span className={styles.fieldErrorText}>{campaignFormErrors.deadline}</span>
                  ) : null}
                </label>

                <div className={`${styles.toggleRow} ${styles.fieldLabelWide}`}>
                  <label className={styles.toggleCard}>
                    <span className={styles.toggleCopy}>
                      <span className={styles.toggleLabel}>Urgent</span>
                      <span className={styles.toggleHint}>Highlight this campaign as urgent.</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={addCampaignForm.isUrgent}
                      onChange={(event) => {
                        setAddCampaignForm((currentForm) => ({
                          ...currentForm,
                          isUrgent: event.target.checked,
                        }))
                      }}
                      className={styles.toggleInput}
                    />
                    <span className={styles.toggleTrack} aria-hidden="true">
                      <span className={styles.toggleThumb} />
                    </span>
                  </label>
                </div>

                <div className={styles.fieldLabelWide}>
                  <PhotoUploadField
                    value={addCampaignForm.photo}
                    onChange={(nextPhoto) => {
                      clearCampaignFormError('photo')
                      setAddCampaignForm((currentForm) => ({ ...currentForm, photo: nextPhoto }))
                    }}
                    onNotify={(message, variant) => {
                      showToast(message, { variant })
                    }}
                    required
                    title="Campaign Photo"
                    subtitle="Upload a campaign image from your device or camera."
                    previewAlt={addCampaignForm.title ? `${addCampaignForm.title} photo` : 'Campaign photo preview'}
                    uploadFolder="donation-campaigns"
                  />
                  {campaignFormErrors.photo ? (
                    <span className={styles.fieldErrorText}>{campaignFormErrors.photo}</span>
                  ) : null}
                </div>

                <label className={`${styles.fieldLabel} ${styles.fieldLabelWide}`}>
                  <span>Description</span>
                  <textarea
                    value={addCampaignForm.description}
                    onChange={(event) => {
                      setAddCampaignForm((currentForm) => ({
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
                <button
                  type="button"
                  className={styles.modalCancelButton}
                  onClick={() => {
                    closeAddModal()
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.modalSubmitButton} disabled={isSavingCampaign}>
                  {isSavingCampaign ? 'Saving...' : editingCampaignId ? 'Save' : 'Add Donation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={Boolean(pendingDeleteCampaign)}
        title="Delete donation campaign?"
        message={`Are you sure you want to delete ${pendingDeleteCampaign?.title ?? 'this donation campaign'}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        ariaLabel="Delete donation campaign confirmation"
        isBusy={campaignIdBeingDeleted !== null}
        onCancel={() => {
          setPendingDeleteCampaign(null)
        }}
        onConfirm={handleDeleteCampaignConfirm}
      />
    </MainLayout>
  )
}

export default DonationCampaignListPage



