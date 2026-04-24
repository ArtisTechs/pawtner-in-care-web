import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { FaEdit, FaPlus, FaTimes, FaTrashAlt } from 'react-icons/fa'
import donationFallbackImage from '@/assets/donate-front-page-icon.png'
import type { AuthSession } from '@/features/auth/types/auth-api'
import {
  DEFAULT_ADD_PAYMENT_MODE_FORM,
  LIST_BATCH_SIZE,
  LIST_INITIAL_BATCH_SIZE,
  LIST_SKELETON_ROW_COUNT,
  type AddPaymentModeForm,
} from '@/features/payment-modes/constants/payment-mode-list.constants'
import { paymentModeService } from '@/features/payment-modes/services/payment-mode.service'
import type { PaymentMode } from '@/features/payment-modes/types/payment-mode-api'
import { buildPaymentModePayload, mapPaymentModeToForm } from '@/features/payment-modes/utils/payment-mode-form'
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
import { toTitleCase } from '@/shared/lib/text/title-case'
import type { SidebarItemKey } from '@/shared/types/layout'
import styles from './PaymentModeListPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'payment-mode-list'

const resolvePaymentModeImage = (paymentMode: PaymentMode) => {
  const trimmedPhotoQr = paymentMode.photoQr?.trim()
  return trimmedPhotoQr || donationFallbackImage
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

const resolveCreatedDate = (paymentMode: PaymentMode) => paymentMode.createdDate ?? paymentMode.createdAt

interface PaymentModeListPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

function PaymentModeListPage({ onLogout, session }: PaymentModeListPageProps) {
  const { clearToast, showToast, toast } = useToast()
  const [searchValue, setSearchValue] = useState('')
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const resolvedHeaderProfile = useHeaderProfile({
    fallbackProfile: defaultHeaderProfile,
    session,
  })
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([])
  const [isLoadingPaymentModes, setIsLoadingPaymentModes] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [viewingPaymentMode, setViewingPaymentMode] = useState<PaymentMode | null>(null)
  const [editingPaymentModeId, setEditingPaymentModeId] = useState<string | null>(null)
  const [isSavingPaymentMode, setIsSavingPaymentMode] = useState(false)
  const [paymentModeIdBeingDeleted, setPaymentModeIdBeingDeleted] = useState<string | null>(null)
  const [pendingDeletePaymentMode, setPendingDeletePaymentMode] = useState<{
    id: string
    name: string
  } | null>(null)
  const [addPaymentModeForm, setAddPaymentModeForm] = useState<AddPaymentModeForm>(
    DEFAULT_ADD_PAYMENT_MODE_FORM,
  )
  const [visiblePaymentModeCount, setVisiblePaymentModeCount] = useState(LIST_INITIAL_BATCH_SIZE)
  const tableScrollRef = useRef<HTMLDivElement | null>(null)
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null)
  const accessToken = session?.accessToken?.trim() ?? ''

  const loadPaymentModes = useCallback(async () => {
    if (!accessToken) {
      setPaymentModes([])
      return
    }

    setIsLoadingPaymentModes(true)

    try {
      const paymentModeList = await paymentModeService.list(accessToken)
      setPaymentModes(Array.isArray(paymentModeList) ? paymentModeList : [])
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsLoadingPaymentModes(false)
    }
  }, [accessToken, showToast])

  useEffect(() => {
    clearToast()
    void loadPaymentModes()
  }, [clearToast, loadPaymentModes])

  const filteredPaymentModes = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()

    if (!normalizedSearch) {
      return paymentModes
    }

    return paymentModes.filter((paymentMode) => {
      const normalizedAccountNumber = paymentMode.accountNumber?.toLowerCase() ?? ''
      const normalizedId = paymentMode.id?.toLowerCase() ?? ''
      const normalizedName = paymentMode.name?.toLowerCase() ?? ''
      const normalizedPhotoQr = paymentMode.photoQr?.toLowerCase() ?? ''

      return (
        normalizedAccountNumber.includes(normalizedSearch) ||
        normalizedId.includes(normalizedSearch) ||
        normalizedName.includes(normalizedSearch) ||
        normalizedPhotoQr.includes(normalizedSearch)
      )
    })
  }, [paymentModes, searchValue])

  useEffect(() => {
    setVisiblePaymentModeCount(LIST_INITIAL_BATCH_SIZE)
  }, [filteredPaymentModes])

  const visiblePaymentModes = useMemo(
    () => filteredPaymentModes.slice(0, visiblePaymentModeCount),
    [filteredPaymentModes, visiblePaymentModeCount],
  )
  const hasMorePaymentModesToReveal = visiblePaymentModes.length < filteredPaymentModes.length
  const skeletonRowIndexes = useMemo(
    () => Array.from({ length: LIST_SKELETON_ROW_COUNT }, (_, index) => index),
    [],
  )

  useEffect(() => {
    const scrollContainer = tableScrollRef.current
    const triggerElement = loadMoreTriggerRef.current
    if (
      !scrollContainer ||
      !triggerElement ||
      isLoadingPaymentModes ||
      !hasMorePaymentModesToReveal
    ) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (!entry?.isIntersecting) {
          return
        }

        setVisiblePaymentModeCount((currentCount) =>
          Math.min(currentCount + LIST_BATCH_SIZE, filteredPaymentModes.length),
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
  }, [filteredPaymentModes.length, hasMorePaymentModesToReveal, isLoadingPaymentModes])

  const closeAddModal = useCallback(() => {
    setIsAddModalOpen(false)
    setEditingPaymentModeId(null)
    setAddPaymentModeForm(DEFAULT_ADD_PAYMENT_MODE_FORM)
  }, [])

  const closeViewModal = useCallback(() => {
    setViewingPaymentMode(null)
  }, [])

  const handleAddPaymentModeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!accessToken) {
      showToast('You need to sign in before managing payment methods.', { variant: 'error' })
      return
    }

    const persistPaymentMode = async () => {
      const trimmedAccountNumber = addPaymentModeForm.accountNumber.trim()
      const trimmedName = addPaymentModeForm.name.trim()
      const trimmedPhotoQr = addPaymentModeForm.photoQr.trim()

      if (!trimmedName || !trimmedAccountNumber || !trimmedPhotoQr) {
        showToast('Please complete all required fields.', { variant: 'error' })
        return
      }

      const payload = buildPaymentModePayload(addPaymentModeForm)
      setIsSavingPaymentMode(true)

      try {
        if (editingPaymentModeId) {
          await paymentModeService.update(editingPaymentModeId, payload, accessToken)
          showToast('Payment method updated successfully.', { variant: 'success' })
        } else {
          await paymentModeService.create(payload, accessToken)
          showToast('Payment method added successfully.', { variant: 'success' })
        }

        closeAddModal()
        await loadPaymentModes()
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setIsSavingPaymentMode(false)
      }
    }

    void persistPaymentMode()
  }

  const handleEditPaymentMode = (paymentMode: PaymentMode) => {
    setEditingPaymentModeId(paymentMode.id)
    setAddPaymentModeForm(mapPaymentModeToForm(paymentMode))
    setIsAddModalOpen(true)
  }

  const handleViewPaymentMode = (paymentMode: PaymentMode) => {
    setViewingPaymentMode(paymentMode)
  }

  const handleDeletePaymentMode = (paymentModeId: string) => {
    if (!accessToken) {
      setPendingDeletePaymentMode(null)
      showToast('You need to sign in before managing payment methods.', { variant: 'error' })
      return
    }

    const deletePaymentMode = async () => {
      setPaymentModeIdBeingDeleted(paymentModeId)

      try {
        await paymentModeService.delete(paymentModeId, accessToken)
        setPaymentModes((currentPaymentModes) =>
          currentPaymentModes.filter((paymentMode) => paymentMode.id !== paymentModeId),
        )
        setViewingPaymentMode((currentPaymentMode) =>
          currentPaymentMode?.id === paymentModeId ? null : currentPaymentMode,
        )
        showToast('Payment method removed successfully.', { variant: 'success' })
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setPendingDeletePaymentMode(null)
        setPaymentModeIdBeingDeleted(null)
      }
    }

    void deletePaymentMode()
  }

  const handleDeletePaymentModeRequest = (paymentMode: PaymentMode) => {
    setPendingDeletePaymentMode({
      id: paymentMode.id,
      name: paymentMode.name?.trim() || 'this payment method',
    })
  }

  const handleDeletePaymentModeConfirm = () => {
    if (!pendingDeletePaymentMode) {
      return
    }

    handleDeletePaymentMode(pendingDeletePaymentMode.id)
  }

  const handleViewEdit = () => {
    if (!viewingPaymentMode) {
      return
    }

    const nextPaymentModeToEdit = viewingPaymentMode
    closeViewModal()
    handleEditPaymentMode(nextPaymentModeToEdit)
  }

  const handleViewDelete = () => {
    if (!viewingPaymentMode) {
      return
    }

    handleDeletePaymentModeRequest(viewingPaymentMode)
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
          <h1 className={styles.pageTitle}>Payment Methods</h1>

          <div className={styles.tablePanel}>
            <div className={styles.tableScroll} ref={tableScrollRef}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">QR</th>
                    <th scope="col">Name</th>
                    <th scope="col">Account Number</th>
                    <th scope="col">Created Date</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {isLoadingPaymentModes ? (
                    skeletonRowIndexes.map((rowIndex) => (
                      <tr key={`payment-mode-skeleton-${rowIndex}`} aria-hidden="true">
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
                          <div className={`${styles.skeletonBlock} ${styles.skeletonAction}`} />
                        </td>
                      </tr>
                    ))
                  ) : filteredPaymentModes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={styles.tableStateCell}>
                        No payment methods found.
                      </td>
                    </tr>
                  ) : (
                    visiblePaymentModes.map((paymentMode) => (
                      <tr
                        key={paymentMode.id}
                        className={styles.clickableRow}
                        onClick={() => {
                          handleViewPaymentMode(paymentMode)
                        }}
                      >
                        <td>
                          <img
                            src={resolvePaymentModeImage(paymentMode)}
                            alt={paymentMode.name || 'Payment method QR'}
                            className={styles.petImage}
                          />
                        </td>
                        <td>{paymentMode.name || 'N/A'}</td>
                        <td>{paymentMode.accountNumber?.trim() || 'N/A'}</td>
                        <td>{formatDateLabel(resolveCreatedDate(paymentMode))}</td>
                        <td>
                          <div className={styles.actionCell}>
                            <button
                              type="button"
                              className={styles.actionButton}
                              aria-label={`Edit ${paymentMode.name}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleEditPaymentMode(paymentMode)
                              }}
                            >
                              <FaEdit aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className={`${styles.actionButton} ${styles.deleteButton}`}
                              aria-label={`Delete ${paymentMode.name}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleDeletePaymentModeRequest(paymentMode)
                              }}
                              disabled={paymentModeIdBeingDeleted === paymentMode.id}
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

              {hasMorePaymentModesToReveal ? (
                <div ref={loadMoreTriggerRef} className={styles.loadMoreTrigger} />
              ) : null}
            </div>

            <button
              type="button"
              className={styles.floatingAddButton}
              aria-label="Add payment method"
              onClick={() => {
                setEditingPaymentModeId(null)
                setAddPaymentModeForm(DEFAULT_ADD_PAYMENT_MODE_FORM)
                setIsAddModalOpen(true)
              }}
            >
              <span className={styles.floatingAddIcon}>
                <FaPlus aria-hidden="true" />
              </span>
              <span className={styles.floatingAddLabel}>Add Payment Method</span>
            </button>
          </div>

          <footer className={styles.tableFooter}>
            <span className={styles.footerText}>
              Showing {visiblePaymentModes.length} of {filteredPaymentModes.length}
            </span>
          </footer>
        </section>
      </div>

      {viewingPaymentMode ? (
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
            aria-labelledby="view-payment-mode-modal-title"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className={styles.modalHeader}>
              <h2 id="view-payment-mode-modal-title" className={styles.modalTitle}>
                Payment Method Details
              </h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => {
                  closeViewModal()
                }}
                aria-label="Close payment method details modal"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className={styles.viewModalBody}>
              <div className={styles.viewMedia}>
                <img
                  src={resolvePaymentModeImage(viewingPaymentMode)}
                  alt={viewingPaymentMode.name || 'Payment method QR'}
                  className={styles.viewImage}
                />
              </div>

              <div className={styles.viewDetailsGrid}>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Name</span>
                  <span className={styles.viewDetailValue}>{viewingPaymentMode.name || 'N/A'}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Account Number</span>
                  <span className={styles.viewDetailValue}>
                    {viewingPaymentMode.accountNumber?.trim() || 'N/A'}
                  </span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Created Date</span>
                  <span className={styles.viewDetailValue}>
                    {formatDateLabel(resolveCreatedDate(viewingPaymentMode))}
                  </span>
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
            aria-labelledby="add-payment-mode-modal-title"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className={styles.modalHeader}>
              <h2 id="add-payment-mode-modal-title" className={styles.modalTitle}>
                {editingPaymentModeId ? 'Edit Payment Method' : 'Add Payment Method'}
              </h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => {
                  closeAddModal()
                }}
                aria-label="Close payment method modal"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={handleAddPaymentModeSubmit} noValidate>
              <div className={styles.modalFields}>
                <label className={styles.fieldLabel}>
                  <span>Name</span>
                  <input
                    type="text"
                    value={addPaymentModeForm.name}
                    onChange={(event) => {
                      setAddPaymentModeForm((currentForm) => ({
                        ...currentForm,
                        name: toTitleCase(event.target.value),
                      }))
                    }}
                    className={styles.fieldInput}
                    placeholder="e.g. GCash"
                  />
                </label>

                <label className={styles.fieldLabel}>
                  <span>Account Number</span>
                  <input
                    type="text"
                    value={addPaymentModeForm.accountNumber}
                    onChange={(event) => {
                      setAddPaymentModeForm((currentForm) => ({
                        ...currentForm,
                        accountNumber: event.target.value,
                      }))
                    }}
                    className={styles.fieldInput}
                    placeholder="e.g. 09171234567"
                  />
                </label>

                <div className={styles.fieldLabelWide}>
                  <PhotoUploadField
                    cropAspectRatio={1}
                    value={addPaymentModeForm.photoQr}
                    onChange={(nextPhotoQr) => {
                      setAddPaymentModeForm((currentForm) => ({ ...currentForm, photoQr: nextPhotoQr }))
                    }}
                    onNotify={(message, variant) => {
                      showToast(message, { variant })
                    }}
                    required
                    title="Payment QR"
                    subtitle="Upload a QR image from your device or camera. Required."
                    previewAlt={addPaymentModeForm.name ? `${addPaymentModeForm.name} QR` : 'Payment QR preview'}
                    uploadFolder="payment-modes"
                  />
                </div>
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
                <button type="submit" className={styles.modalSubmitButton} disabled={isSavingPaymentMode}>
                  {isSavingPaymentMode ? 'Saving...' : editingPaymentModeId ? 'Save' : 'Add Method'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={Boolean(pendingDeletePaymentMode)}
        title="Delete payment method?"
        message={`Are you sure you want to delete ${pendingDeletePaymentMode?.name ?? 'this payment method'}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        ariaLabel="Delete payment method confirmation"
        isBusy={paymentModeIdBeingDeleted !== null}
        onCancel={() => {
          setPendingDeletePaymentMode(null)
        }}
        onConfirm={handleDeletePaymentModeConfirm}
      />
    </MainLayout>
  )
}

export default PaymentModeListPage
