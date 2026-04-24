import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type UIEvent } from 'react'
import { FaBoxOpen, FaEdit, FaPlus, FaTimes, FaTrashAlt } from 'react-icons/fa'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { itemListingService } from '@/features/item-listings/services/item-listing.service'
import type { CreateItemListingPayload, ItemListing, ItemListingType } from '@/features/item-listings/types/item-listing-api'
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
import { toTitleCase } from '@/shared/lib/text/title-case'
import type { SidebarItemKey } from '@/shared/types/layout'
import styles from './ItemListingPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'item-listing'
const REQUIRED_FIELDS_ERROR_MESSAGE = 'Please complete all required fields.'
const ITEM_LIST_PAGE_SIZE = 20

type CreateItemListingForm = {
  categories: string[]
  details: string
  isShow: string
  itemName: string
  photo: string
  type: string
}

type CreateItemListingFormErrorKey = 'itemName'
type CreateItemListingFormErrors = Record<CreateItemListingFormErrorKey, string>

const DEFAULT_CREATE_FORM: CreateItemListingForm = {
  categories: [''],
  details: '',
  isShow: 'true',
  itemName: '',
  photo: '',
  type: '',
}

const createEmptyCreateFormErrors = (): CreateItemListingFormErrors => ({
  itemName: '',
})

const normalizeText = (value?: string | null) => value?.trim() || ''

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

const normalizeCategoryValues = (values: string[]) =>
  values
    .map((category) => category.trim())
    .filter(Boolean)

const ITEM_LISTING_TYPE_OPTIONS: ReadonlyArray<{ label: string; value: ItemListingType }> = [
  { label: 'Dogs', value: 'dogs' },
  { label: 'Cats', value: 'cats' },
  { label: 'Shelter', value: 'shelter' },
  { label: 'Care Box', value: 'care box' },
]

const normalizeItemListingType = (value?: string | null): ItemListingType | '' => {
  const normalizedValue = normalizeText(value).toLowerCase()

  if (normalizedValue === 'dogs' || normalizedValue === 'cats' || normalizedValue === 'shelter' || normalizedValue === 'care box') {
    return normalizedValue
  }

  return ''
}

const toItemListingTypeLabel = (value?: string | null) => {
  const normalizedValue = normalizeItemListingType(value)
  if (!normalizedValue) {
    return 'N/A'
  }

  return ITEM_LISTING_TYPE_OPTIONS.find((option) => option.value === normalizedValue)?.label ?? normalizedValue
}

const mapItemListingToForm = (itemListing: ItemListing): CreateItemListingForm => ({
  categories:
    (itemListing.categories ?? []).map((category) => normalizeText(category)).filter(Boolean).length > 0
      ? (itemListing.categories ?? []).map((category) => normalizeText(category)).filter(Boolean)
      : [''],
  details: normalizeText(itemListing.details),
  isShow: itemListing.isShow === false ? 'false' : 'true',
  itemName: normalizeText(itemListing.itemName),
  photo: normalizeText(itemListing.photo),
  type: normalizeItemListingType(itemListing.type),
})

const resolveItemName = (itemListing: ItemListing) => normalizeText(itemListing.itemName) || 'Untitled Item'
const resolveItemDetails = (itemListing: ItemListing) =>
  normalizeText(itemListing.details) || 'No details provided.'

const resolveVisibilityStatusUi = (isVisible: boolean): { label: string; tone: StatusBadgeTone } => {
  if (isVisible) {
    return { label: 'Visible', tone: 'positive' }
  }

  return { label: 'Hidden', tone: 'warning' }
}

interface ItemListingPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

function ItemListingPage({ onLogout, session }: ItemListingPageProps) {
  const { clearToast, showToast, toast } = useToast()
  const [searchValue, setSearchValue] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [isLoadingItemListings, setIsLoadingItemListings] = useState(false)
  const [itemListings, setItemListings] = useState<ItemListing[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMoreItemListings, setHasMoreItemListings] = useState(false)
  const [isLoadingMoreItemListings, setIsLoadingMoreItemListings] = useState(false)
  const [viewingItemListing, setViewingItemListing] = useState<ItemListing | null>(null)
  const [isLoadingItemDetails, setIsLoadingItemDetails] = useState(false)
  const [editingItemListingId, setEditingItemListingId] = useState<string | null>(null)
  const [itemListingIdBeingDeleted, setItemListingIdBeingDeleted] = useState<string | null>(null)
  const [itemListingIdBeingShowToggled, setItemListingIdBeingShowToggled] = useState<string | null>(null)
  const [pendingDeleteItemListing, setPendingDeleteItemListing] = useState<{ id: string; title: string } | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isSavingItemListing, setIsSavingItemListing] = useState(false)
  const [createForm, setCreateForm] = useState<CreateItemListingForm>(DEFAULT_CREATE_FORM)
  const [createFormErrors, setCreateFormErrors] = useState<CreateItemListingFormErrors>(createEmptyCreateFormErrors)

  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const resolvedHeaderProfile = useHeaderProfile({ fallbackProfile: defaultHeaderProfile, session })
  const accessToken = session?.accessToken?.trim() ?? ''

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchValue.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [searchValue])

  const isLoadingMoreItemListingsRef = useRef(false)
  const canTriggerLoadMoreRef = useRef(true)

  const loadItemListings = useCallback(async (options?: { append?: boolean; page?: number }) => {
    if (!accessToken) {
      setItemListings([])
      setCurrentPage(0)
      setHasMoreItemListings(false)
      return
    }

    const shouldAppend = Boolean(options?.append)
    const targetPage = Math.max(0, options?.page ?? 0)

    if (shouldAppend) {
      setIsLoadingMoreItemListings(true)
    } else {
      setIsLoadingItemListings(true)
    }

    try {
      const result = await itemListingService.list(accessToken, {
        page: targetPage,
        search: debouncedSearch || undefined,
        size: ITEM_LIST_PAGE_SIZE,
        sortBy: 'itemName',
        sortDir: 'asc',
      })
      setItemListings((currentItems) => {
        if (!shouldAppend) {
          return result.items
        }

        const itemMap = new Map(currentItems.map((item) => [item.id, item]))
        result.items.forEach((item) => {
          itemMap.set(item.id, item)
        })

        return Array.from(itemMap.values())
      })
      setCurrentPage(result.page)
      setHasMoreItemListings(!result.isLast && result.page + 1 < result.totalPages)
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      if (shouldAppend) {
        setIsLoadingMoreItemListings(false)
      } else {
        setIsLoadingItemListings(false)
      }
    }
  }, [accessToken, debouncedSearch, showToast])

  useEffect(() => {
    clearToast()
    void loadItemListings()
  }, [clearToast, loadItemListings])

  const clearCreateFormError = useCallback((field: CreateItemListingFormErrorKey) => {
    setCreateFormErrors((current) => (current[field] ? { ...current, [field]: '' } : current))
  }, [])

  const openCreateModal = () => {
    setEditingItemListingId(null)
    setCreateForm(DEFAULT_CREATE_FORM)
    setCreateFormErrors(createEmptyCreateFormErrors())
    setIsCreateModalOpen(true)
  }

  const closeCreateModal = useCallback(() => {
    setIsCreateModalOpen(false)
    setEditingItemListingId(null)
    setIsSavingItemListing(false)
    setCreateForm(DEFAULT_CREATE_FORM)
    setCreateFormErrors(createEmptyCreateFormErrors())
  }, [])

  const closeViewModal = useCallback(() => {
    setViewingItemListing(null)
    setIsLoadingItemDetails(false)
  }, [])

  const handleViewItemListing = (itemListing: ItemListing) => {
    setViewingItemListing(itemListing)
    const itemListingId = normalizeText(itemListing.id)
    if (!accessToken || !itemListingId) {
      return
    }

    const loadDetails = async () => {
      setIsLoadingItemDetails(true)
      try {
        const details = await itemListingService.getOne(itemListingId, accessToken)
        setViewingItemListing((current) => {
          if (!current || normalizeText(current.id) !== itemListingId) {
            return current
          }
          return details
        })
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setIsLoadingItemDetails(false)
      }
    }

    void loadDetails()
  }

  const handleEditItemListing = (itemListing: ItemListing) => {
    setEditingItemListingId(itemListing.id)
    setCreateForm(mapItemListingToForm(itemListing))
    setCreateFormErrors(createEmptyCreateFormErrors())
    setIsCreateModalOpen(true)
  }

  const handleToggleShow = (itemListing: ItemListing, nextIsShow: boolean) => {
    if (!accessToken) {
      showToast('You need to sign in before managing item listings.', { variant: 'error' })
      return
    }

    const itemListingId = normalizeText(itemListing.id)
    if (!itemListingId) {
      showToast('Unable to update this item listing because its ID is missing.', { variant: 'error' })
      return
    }

    const run = async () => {
      setItemListingIdBeingShowToggled(itemListingId)
      try {
        await itemListingService.updateShow(itemListingId, nextIsShow, accessToken)
        setItemListings((current) =>
          current.map((value) => (value.id === itemListingId ? { ...value, isShow: nextIsShow } : value)),
        )
        setViewingItemListing((current) =>
          current && current.id === itemListingId ? { ...current, isShow: nextIsShow } : current,
        )
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setItemListingIdBeingShowToggled(null)
      }
    }

    void run()
  }

  const handleDeleteItemListing = (itemListingId: string) => {
    if (!accessToken) {
      setPendingDeleteItemListing(null)
      showToast('You need to sign in before managing item listings.', { variant: 'error' })
      return
    }

    const run = async () => {
      setItemListingIdBeingDeleted(itemListingId)
      try {
        await itemListingService.delete(itemListingId, accessToken)
        setItemListings((current) => current.filter((item) => item.id !== itemListingId))
        setViewingItemListing((current) => (current?.id === itemListingId ? null : current))
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setPendingDeleteItemListing(null)
        setItemListingIdBeingDeleted(null)
      }
    }

    void run()
  }

  const handleDeleteItemListingRequest = (itemListing: ItemListing) => {
    setPendingDeleteItemListing({
      id: normalizeText(itemListing.id),
      title: resolveItemName(itemListing),
    })
  }

  const handleDeleteItemListingConfirm = () => {
    if (!pendingDeleteItemListing) {
      return
    }
    handleDeleteItemListing(pendingDeleteItemListing.id)
  }

  const handleCategoryChange = (index: number, nextValue: string) => {
    setCreateForm((current) => {
      const nextCategories = [...current.categories]
      nextCategories[index] = nextValue
      return { ...current, categories: nextCategories }
    })
  }

  const handleAddCategoryField = () => {
    setCreateForm((current) => ({ ...current, categories: [...current.categories, ''] }))
  }

  const handleRemoveCategoryField = (index: number) => {
    setCreateForm((current) => {
      if (current.categories.length <= 1) {
        return { ...current, categories: [''] }
      }
      return {
        ...current,
        categories: current.categories.filter((_, currentIndex) => currentIndex !== index),
      }
    })
  }

  const handleCreateItemListingSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!accessToken) {
      showToast('You need to sign in before managing item listings.', { variant: 'error' })
      return
    }

    const trimmedItemName = toTitleCase(createForm.itemName).trim()
    const trimmedDetails = createForm.details.trim()
    const trimmedPhoto = createForm.photo.trim()
    const categories = normalizeCategoryValues(createForm.categories)
    const normalizedType = normalizeItemListingType(createForm.type)
    const nextErrors = createEmptyCreateFormErrors()

    if (!trimmedItemName) {
      nextErrors.itemName = REQUIRED_FIELDS_ERROR_MESSAGE
    }

    const hasFormErrors = Object.values(nextErrors).some(Boolean)
    if (hasFormErrors) {
      setCreateFormErrors(nextErrors)
      showToast('Please resolve the errors before submitting.', { variant: 'error' })
      return
    }

    const run = async () => {
      setIsSavingItemListing(true)
      try {
        const payload: CreateItemListingPayload = {
          isShow: createForm.isShow === 'true',
          itemName: trimmedItemName,
          ...(categories.length > 0 ? { categories } : {}),
          ...(trimmedDetails ? { details: trimmedDetails } : {}),
          ...(trimmedPhoto ? { photo: trimmedPhoto } : {}),
          ...(normalizedType ? { type: normalizedType } : {}),
        }

        if (editingItemListingId) {
          await itemListingService.update(editingItemListingId, payload, accessToken)
        } else {
          await itemListingService.create(payload, accessToken)
        }

        closeCreateModal()
        await loadItemListings()
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setIsSavingItemListing(false)
      }
    }

    void run()
  }

  const handleViewEdit = () => {
    if (!viewingItemListing) {
      return
    }
    const target = viewingItemListing
    closeViewModal()
    handleEditItemListing(target)
  }

  const handleViewDelete = () => {
    if (!viewingItemListing) {
      return
    }
    handleDeleteItemListingRequest(viewingItemListing)
    closeViewModal()
  }

  const skeletonCardIndexes = useMemo(() => Array.from({ length: 6 }, (_, index) => index), [])
  const handleTableScroll = (event: UIEvent<HTMLDivElement>) => {
    if (
      !hasMoreItemListings ||
      isLoadingItemListings ||
      isLoadingMoreItemListings ||
      isLoadingMoreItemListingsRef.current
    ) {
      return
    }

    const scrollElement = event.currentTarget
    const distanceFromBottom =
      scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight

    if (distanceFromBottom > 180) {
      canTriggerLoadMoreRef.current = true
      return
    }

    if (distanceFromBottom <= 120 && canTriggerLoadMoreRef.current) {
      canTriggerLoadMoreRef.current = false
      isLoadingMoreItemListingsRef.current = true

      const loadMore = async () => {
        try {
          await loadItemListings({ append: true, page: currentPage + 1 })
        } finally {
          isLoadingMoreItemListingsRef.current = false
        }
      }

      void loadMore()
    }
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
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>Item Listings</h1>
          </div>

          <div className={styles.tablePanel}>
            <div className={styles.tableScroll} onScroll={handleTableScroll}>
              {isLoadingItemListings ? (
                <div className={styles.cardGrid}>
                  {skeletonCardIndexes.map((skeletonIndex) => (
                    <article key={`item-listing-skeleton-${skeletonIndex}`} className={styles.skeletonCard} aria-hidden="true">
                      <div className={styles.skeletonTitle} />
                      <div className={styles.skeletonLine} />
                      <div className={styles.skeletonLine} />
                      <div className={styles.skeletonMeta} />
                    </article>
                  ))}
                </div>
              ) : itemListings.length === 0 ? (
                <div className={styles.tableStateWrap}>
                  <div className={styles.tableStateCell}>No item listings found.</div>
                </div>
              ) : (
                <div className={styles.cardGrid}>
                  {itemListings.map((itemListing) => {
                    const itemListingId = normalizeText(itemListing.id)
                    const categoriesLabel =
                      (itemListing.categories ?? []).map((value) => normalizeText(value)).filter(Boolean).join(', ') || 'N/A'
                    const itemTypeLabel = toItemListingTypeLabel(itemListing.type)
                    const visibilityStatus = resolveVisibilityStatusUi(itemListing.isShow !== false)

                    return (
                      <article key={itemListing.id} className={styles.card}>
                        <div className={styles.cardCompactContent}>
                          <div className={styles.cardCompactHeader}>
                            <h2 className={styles.cardTitle}>{resolveItemName(itemListing)}</h2>
                            <button
                              type="button"
                              className={styles.cardDeleteIconButton}
                              onClick={() => handleDeleteItemListingRequest(itemListing)}
                              disabled={!itemListingId || itemListingIdBeingDeleted === itemListingId}
                              aria-label={`Delete ${resolveItemName(itemListing)}`}
                            >
                              <FaTrashAlt aria-hidden="true" />
                            </button>
                          </div>

                          <div className={styles.cardCompactPhotoWrap}>
                            {normalizeText(itemListing.photo) ? (
                              <img
                                src={normalizeText(itemListing.photo)}
                                alt={resolveItemName(itemListing)}
                                className={styles.cardCompactPhoto}
                              />
                            ) : (
                              <FaBoxOpen aria-hidden="true" className={styles.cardCompactPhotoFallback} />
                            )}
                          </div>

                          <div className={styles.cardCompactMeta}>
                            <div className={styles.cardCompactMetaRow}>
                              <span className={styles.cardCompactMetaLabel}>Categories</span>
                              <span className={styles.cardCompactMetaValue}>{categoriesLabel}</span>
                            </div>
                            <div className={styles.cardCompactMetaRow}>
                              <span className={styles.cardCompactMetaLabel}>Type</span>
                              <span className={styles.cardCompactMetaValue}>{itemTypeLabel}</span>
                            </div>
                            <div className={styles.cardCompactMetaRow}>
                              <span className={styles.cardCompactMetaLabel}>Status</span>
                              <span className={styles.cardCompactMetaValue}>
                                <StatusBadge label={visibilityStatus.label} tone={visibilityStatus.tone} />
                              </span>
                            </div>
                          </div>

                          <div className={styles.cardActionRow}>
                            <button type="button" className={styles.cardViewButton} onClick={() => handleViewItemListing(itemListing)}>
                              View
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>

            <button type="button" className={styles.floatingAddButton} onClick={openCreateModal} aria-label="Create item listing">
              <span className={styles.floatingAddIcon}>
                <FaPlus aria-hidden="true" />
              </span>
              <span className={styles.floatingAddLabel}>Create Item</span>
            </button>
          </div>
        </section>
      </div>

      {viewingItemListing ? (
        <div className={styles.modalOverlay} onClick={(event) => event.target === event.currentTarget && closeViewModal()}>
          <div
            className={`${styles.modalCard} ${styles.viewModalCard}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-item-listing-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 id="view-item-listing-modal-title" className={styles.modalTitle}>Item Listing Details</h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeViewModal}
                aria-label="Close item listing details modal"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className={styles.viewModalBody}>
              {isLoadingItemDetails ? <p className={styles.cardDescription}>Refreshing item details...</p> : null}

              <div className={styles.viewAchievementTop}>
                <div className={styles.iconWrap}>
                  {normalizeText(viewingItemListing.photo) ? (
                    <img
                      src={normalizeText(viewingItemListing.photo)}
                      alt={resolveItemName(viewingItemListing)}
                      className={styles.viewAchievementImage}
                    />
                  ) : (
                    <span className={styles.viewAchievementIcon} aria-hidden="true">
                      <FaBoxOpen />
                    </span>
                  )}
                </div>
                <div className={styles.viewAchievementTitleWrap}>
                  <h3 className={styles.viewAchievementTitle}>{resolveItemName(viewingItemListing)}</h3>
                  <p className={styles.viewAchievementDescription}>{resolveItemDetails(viewingItemListing)}</p>
                </div>
              </div>

              <dl className={styles.metaGrid}>
                <div className={styles.metaItem}>
                  <dt>Categories</dt>
                  <dd>{(viewingItemListing.categories ?? []).filter(Boolean).join(', ') || 'N/A'}</dd>
                </div>
                <div className={styles.metaItem}>
                  <dt>Type</dt>
                  <dd>{toItemListingTypeLabel(viewingItemListing.type)}</dd>
                </div>
                <div className={styles.metaItem}>
                  <dt>Visible</dt>
                  <dd>
                    <StatusBadge
                      label={resolveVisibilityStatusUi(viewingItemListing.isShow !== false).label}
                      tone={resolveVisibilityStatusUi(viewingItemListing.isShow !== false).tone}
                    />
                  </dd>
                </div>
              </dl>

              <div className={styles.viewVisibilityToggleWrap}>
                <label className={styles.toggleCard}>
                  <span className={styles.toggleCopy}>
                    <span className={styles.toggleLabel}>Visibility</span>
                    <span className={styles.toggleHint}>
                      Toggle to hide or unhide this item listing.
                    </span>
                  </span>
                  <input
                    className={styles.toggleInput}
                    type="checkbox"
                    checked={viewingItemListing.isShow !== false}
                    onChange={(event) => handleToggleShow(viewingItemListing, event.target.checked)}
                    disabled={
                      !normalizeText(viewingItemListing.id) ||
                      itemListingIdBeingShowToggled === normalizeText(viewingItemListing.id)
                    }
                  />
                  <span className={styles.toggleTrack} aria-hidden="true">
                    <span className={styles.toggleThumb} />
                  </span>
                </label>
              </div>

              <div className={styles.cardFooter}>
                <span>Created: {toFormattedDate(viewingItemListing.createdAt)}</span>
                <span>Updated: {toFormattedDate(viewingItemListing.updatedAt)}</span>
              </div>
            </div>

            <div className={`${styles.modalActions} ${styles.viewModalActions}`}>
              <button type="button" className={styles.modalCancelButton} onClick={closeViewModal}>Close</button>
              <button type="button" className={styles.modalSubmitButton} onClick={handleViewEdit}>
                <FaEdit aria-hidden="true" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                className={`${styles.modalSubmitButton} ${styles.viewDeleteButton}`}
                onClick={handleViewDelete}
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
          onClick={(event) => event.target === event.currentTarget && !isSavingItemListing && closeCreateModal()}
        >
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-item-listing-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 id="create-item-listing-modal-title" className={styles.modalTitle}>
                {editingItemListingId ? 'Edit Item Listing' : 'Create Item Listing'}
              </h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeCreateModal}
                disabled={isSavingItemListing}
                aria-label={editingItemListingId ? 'Close edit item listing modal' : 'Close create item listing modal'}
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={handleCreateItemListingSubmit} noValidate>
              <div className={styles.modalFields}>
                <label className={styles.fieldLabel}>
                  <span>
                    Item Name <span className={styles.requiredMark}>*</span>
                  </span>
                  <input
                    className={`${styles.fieldInput} ${createFormErrors.itemName ? styles.fieldInputError : ''}`}
                    type="text"
                    value={createForm.itemName}
                    onChange={(event) => {
                      clearCreateFormError('itemName')
                      setCreateForm((currentForm) => ({
                        ...currentForm,
                        itemName: toTitleCase(event.target.value),
                      }))
                    }}
                    disabled={isSavingItemListing}
                    placeholder="Premium Dog Leash"
                  />
                  {createFormErrors.itemName ? <span className={styles.fieldErrorText}>{createFormErrors.itemName}</span> : null}
                </label>

                <label className={styles.fieldLabel}>
                  <span>Type</span>
                  <select
                    className={styles.fieldInput}
                    value={createForm.type}
                    onChange={(event) => setCreateForm((currentForm) => ({ ...currentForm, type: event.target.value }))}
                    disabled={isSavingItemListing}
                  >
                    <option value="">Select type</option>
                    {ITEM_LISTING_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={`${styles.fieldLabel} ${styles.fullWidthField}`}>
                  <span>Details</span>
                  <textarea
                    className={styles.fieldTextarea}
                    value={createForm.details}
                    onChange={(event) => setCreateForm((currentForm) => ({ ...currentForm, details: event.target.value }))}
                    disabled={isSavingItemListing}
                    rows={3}
                    placeholder="Nylon leash, 1.5 meters, reflective stripes"
                  />
                </label>

                <div className={`${styles.uploadFieldWrap} ${styles.fullWidthField}`}>
                  <PhotoUploadField
                    value={createForm.photo}
                    onChange={(nextPhoto) => setCreateForm((currentForm) => ({ ...currentForm, photo: nextPhoto }))}
                    onNotify={(message, variant) => showToast(message, { variant })}
                    title="Item Photo"
                    subtitle="Upload the item photo from your device or camera."
                    previewAlt={createForm.itemName ? `${createForm.itemName} photo` : 'Item photo preview'}
                    uploadFolder="item-listings"
                    disabled={isSavingItemListing}
                    cropAspectRatio={1}
                  />
                </div>

                <div className={`${styles.fieldLabel} ${styles.fullWidthField}`}>
                  <span>Categories</span>
                  <div className={styles.contactNumbersControl}>
                    {createForm.categories.map((category, index) => (
                      <div key={`item-category-${index}`} className={styles.contactNumberRow}>
                        <input
                          className={styles.fieldInput}
                          type="text"
                          value={category}
                          onChange={(event) => handleCategoryChange(index, event.target.value)}
                          disabled={isSavingItemListing}
                          placeholder="Pet Accessories"
                        />
                        <button
                          type="button"
                          className={styles.contactRemoveButton}
                          onClick={() => handleRemoveCategoryField(index)}
                          disabled={isSavingItemListing}
                          aria-label={`Remove category ${index + 1}`}
                        >
                          Remove
                        </button>
                      </div>
                    ))}

                    <button type="button" className={styles.contactAddButton} onClick={handleAddCategoryField} disabled={isSavingItemListing}>
                      Add Category
                    </button>
                  </div>
                </div>

                <div className={`${styles.toggleRow} ${styles.fullWidthField}`}>
                  <label className={styles.toggleCard}>
                    <span className={styles.toggleCopy}>
                      <span className={styles.toggleLabel}>Is Show</span>
                      <span className={styles.toggleHint}>Controls visibility of this item listing.</span>
                    </span>
                    <input
                      className={styles.toggleInput}
                      type="checkbox"
                      checked={createForm.isShow === 'true'}
                      onChange={(event) =>
                        setCreateForm((currentForm) => ({ ...currentForm, isShow: event.target.checked ? 'true' : 'false' }))
                      }
                      disabled={isSavingItemListing}
                    />
                    <span className={styles.toggleTrack} aria-hidden="true">
                      <span className={styles.toggleThumb} />
                    </span>
                  </label>
                </div>
              </div>

              <div className={styles.modalActions}>
                <div className={styles.modalButtonRow}>
                  <button type="button" className={styles.modalCancelButton} onClick={closeCreateModal} disabled={isSavingItemListing}>
                    Cancel
                  </button>

                  <button type="submit" className={styles.modalSubmitButton} disabled={isSavingItemListing}>
                    {isSavingItemListing
                      ? editingItemListingId
                        ? 'Saving...'
                        : 'Creating...'
                      : editingItemListingId
                        ? 'Save Changes'
                        : 'Create Item Listing'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={Boolean(pendingDeleteItemListing)}
        title="Delete item listing?"
        message={`Are you sure you want to delete ${pendingDeleteItemListing?.title ?? 'this item listing'}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        ariaLabel="Delete item listing confirmation"
        isBusy={itemListingIdBeingDeleted !== null}
        onCancel={() => setPendingDeleteItemListing(null)}
        onConfirm={handleDeleteItemListingConfirm}
      />
    </MainLayout>
  )
}

export default ItemListingPage









