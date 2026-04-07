import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { FaEdit, FaPlus, FaTimes, FaTrashAlt } from 'react-icons/fa'
import catPlaceholderImage from '@/assets/cat.png'
import dogPlaceholderImage from '@/assets/dog.png'
import type { AuthSession } from '@/features/auth/types/auth-api'
import AnimalBadge from '@/features/pets/components/AnimalBadge'
import {
  type AddPetForm,
  DEFAULT_ADD_PET_FORM,
  LIST_BATCH_SIZE,
  LIST_INITIAL_BATCH_SIZE,
  LIST_SKELETON_ROW_COUNT,
  STATUS_LABELS,
} from '@/features/pets/constants/pet-list.constants'
import { petService } from '@/features/pets/services/pet.service'
import type { Pet, PetStatus } from '@/features/pets/types/pet-api'
import {
  buildPetPayload,
  mapPetToForm,
  resolveAnimalFromType,
  toProperNameCase,
} from '@/features/pets/utils/pet-form'
import { defaultHeaderProfile, sidebarBottomItems, sidebarLogo, sidebarMenuItems } from '@/layouts/config/navigation'
import Header from '@/layouts/Header/Header'
import MainLayout from '@/layouts/MainLayout/MainLayout'
import Sidebar from '@/layouts/Sidebar/Sidebar'
import { getErrorMessage } from '@/shared/api/api-error'
import Toast from '@/shared/components/feedback/Toast'
import PhotoUploadField from '@/shared/components/media/PhotoUploadField/PhotoUploadField'
import VideoUploadField from '@/shared/components/media/VideoUploadField/VideoUploadField'
import ConfirmModal from '@/shared/components/ui/ConfirmModal/ConfirmModal'
import { useHeaderProfile } from '@/shared/hooks/useHeaderProfile'
import { useResponsiveSidebar } from '@/shared/hooks/useResponsiveSidebar'
import { useToast } from '@/shared/hooks/useToast'
import type { SidebarItemKey } from '@/shared/types/layout'
import styles from './PetListPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'pet-list'

const resolvePetImage = (pet: Pet) => {
  if (pet.photo) {
    return pet.photo
  }

  const normalizedType = pet.type.trim().toLowerCase()
  return normalizedType === 'cat' ? catPlaceholderImage : dogPlaceholderImage
}

const formatDateInputValue = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

const formatMeasure = (value?: number | null, unit?: string) => {
  if (value === undefined || value === null) {
    return 'N/A'
  }

  if (!unit) {
    return String(value)
  }

  return `${value} ${unit}`
}

const resolveAdoptedByLabel = (adoptedBy?: Pet['adoptedBy']) => {
  if (!adoptedBy) {
    return 'N/A'
  }

  if (typeof adoptedBy === 'string') {
    const normalized = adoptedBy.trim()
    return normalized || 'N/A'
  }

  const name = [adoptedBy.firstName, adoptedBy.middleName, adoptedBy.lastName]
    .map((namePart) => namePart?.trim() || '')
    .filter(Boolean)
    .join(' ')

  if (name) {
    return name
  }

  const email = adoptedBy.email?.trim()
  if (email) {
    return email
  }

  const identifier = adoptedBy.id?.trim()
  return identifier || 'N/A'
}

interface PetListPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

function PetListPage({ onLogout, session }: PetListPageProps) {
  const { clearToast, showToast, toast } = useToast()
  const [searchValue, setSearchValue] = useState('')
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const resolvedHeaderProfile = useHeaderProfile({
    fallbackProfile: defaultHeaderProfile,
    session,
  })
  const [pets, setPets] = useState<Pet[]>([])
  const [isLoadingPets, setIsLoadingPets] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [viewingPet, setViewingPet] = useState<Pet | null>(null)
  const [editingPetId, setEditingPetId] = useState<string | null>(null)
  const [isSavingPet, setIsSavingPet] = useState(false)
  const [petIdBeingDeleted, setPetIdBeingDeleted] = useState<string | null>(null)
  const [pendingDeletePet, setPendingDeletePet] = useState<{ id: string; name: string } | null>(null)
  const [addPetForm, setAddPetForm] = useState<AddPetForm>(DEFAULT_ADD_PET_FORM)
  const [petNameError, setPetNameError] = useState('')
  const [adoptionDateError, setAdoptionDateError] = useState('')
  const [petPhotoError, setPetPhotoError] = useState('')
  const [visiblePetCount, setVisiblePetCount] = useState(LIST_INITIAL_BATCH_SIZE)
  const tableScrollRef = useRef<HTMLDivElement | null>(null)
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null)
  const accessToken = session?.accessToken?.trim() ?? ''
  const maxBirthDate = useMemo(() => formatDateInputValue(new Date()), [])
  const shouldShowAdoptionDate = addPetForm.status === 'ADOPTED'

  const loadPets = useCallback(async () => {
    if (!accessToken) {
      setPets([])
      return
    }

    setIsLoadingPets(true)

    try {
      const petList = await petService.list(accessToken)
      setPets(Array.isArray(petList) ? petList : [])
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsLoadingPets(false)
    }
  }, [accessToken, showToast])

  useEffect(() => {
    clearToast()
    void loadPets()
  }, [clearToast, loadPets])

  const filteredPets = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()

    if (!normalizedSearch) {
      return pets
    }

    return pets.filter((pet) => {
      const normalizedName = pet.name?.toLowerCase() ?? ''
      const normalizedType = pet.type?.toLowerCase() ?? ''
      const normalizedStatus = pet.status?.toLowerCase() ?? ''

      return (
        normalizedName.includes(normalizedSearch) ||
        normalizedType.includes(normalizedSearch) ||
        normalizedStatus.includes(normalizedSearch)
      )
    })
  }, [pets, searchValue])

  useEffect(() => {
    setVisiblePetCount(LIST_INITIAL_BATCH_SIZE)
  }, [filteredPets])

  const visiblePets = useMemo(
    () => filteredPets.slice(0, visiblePetCount),
    [filteredPets, visiblePetCount],
  )
  const hasMorePetsToReveal = visiblePets.length < filteredPets.length
  const skeletonRowIndexes = useMemo(
    () => Array.from({ length: LIST_SKELETON_ROW_COUNT }, (_, index) => index),
    [],
  )

  useEffect(() => {
    const scrollContainer = tableScrollRef.current
    const triggerElement = loadMoreTriggerRef.current
    if (!scrollContainer || !triggerElement || isLoadingPets || !hasMorePetsToReveal) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (!entry?.isIntersecting) {
          return
        }

        setVisiblePetCount((currentCount) =>
          Math.min(currentCount + LIST_BATCH_SIZE, filteredPets.length),
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
  }, [filteredPets.length, hasMorePetsToReveal, isLoadingPets])

  const closeAddModal = useCallback(() => {
    setIsAddModalOpen(false)
    setEditingPetId(null)
    setAddPetForm(DEFAULT_ADD_PET_FORM)
    setPetNameError('')
    setAdoptionDateError('')
    setPetPhotoError('')
  }, [])

  const closeViewModal = useCallback(() => {
    setViewingPet(null)
  }, [])

  const handleAddPetSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!accessToken) {
      showToast('You need to sign in before managing pets.', { variant: 'error' })
      return
    }

    const persistPet = async () => {
      const trimmedName = addPetForm.name.trim()
      const trimmedGender = addPetForm.gender.trim()
      const trimmedType = addPetForm.type.trim()

      setPetNameError('')
      setAdoptionDateError('')
      setPetPhotoError('')

      if (!trimmedName || !trimmedGender || !trimmedType || !addPetForm.status) {
        if (!trimmedName) {
          setPetNameError('Pet name is required.')
        }

        showToast('Please complete all required fields.', { variant: 'error' })
        return
      }

      if (addPetForm.status === 'ADOPTED' && !addPetForm.adoptionDate.trim()) {
        const errorMessage = 'Adoption date is required for adopted pets.'
        setAdoptionDateError(errorMessage)
        showToast(errorMessage, { variant: 'error' })
        return
      }

      if (!addPetForm.photo.trim()) {
        const errorMessage = 'Pet photo is required.'
        setPetPhotoError(errorMessage)
        showToast(errorMessage, { variant: 'error' })
        return
      }

      const payload = buildPetPayload(addPetForm)

      setIsSavingPet(true)

      try {
        if (editingPetId) {
          await petService.update(editingPetId, payload, accessToken)
          showToast('Pet updated successfully.', { variant: 'success' })
        } else {
          await petService.create(payload, accessToken)
          showToast('Pet added successfully.', { variant: 'success' })
        }

        closeAddModal()
        await loadPets()
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setIsSavingPet(false)
      }
    }

    void persistPet()
  }

  const handleEditPet = (pet: Pet) => {
    setEditingPetId(pet.id)
    setAddPetForm(mapPetToForm(pet))
    setPetNameError('')
    setAdoptionDateError('')
    setPetPhotoError('')
    setIsAddModalOpen(true)
  }

  const handleViewPet = (pet: Pet) => {
    setViewingPet(pet)
  }

  const handleDeletePet = (petId: string) => {
    if (!accessToken) {
      setPendingDeletePet(null)
      showToast('You need to sign in before managing pets.', { variant: 'error' })
      return
    }

    const deletePet = async () => {
      setPetIdBeingDeleted(petId)

      try {
        await petService.delete(petId, accessToken)
        setPets((currentPets) => currentPets.filter((pet) => pet.id !== petId))
        setViewingPet((currentPet) => (currentPet?.id === petId ? null : currentPet))
        showToast('Pet removed successfully.', { variant: 'success' })
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setPendingDeletePet(null)
        setPetIdBeingDeleted(null)
      }
    }

    void deletePet()
  }

  const handleDeletePetRequest = (pet: Pet) => {
    setPendingDeletePet({
      id: pet.id,
      name: pet.name?.trim() || 'this pet',
    })
  }

  const handleDeletePetConfirm = () => {
    if (!pendingDeletePet) {
      return
    }

    const petId = pendingDeletePet.id
    handleDeletePet(petId)
  }

  const handleViewEdit = () => {
    if (!viewingPet) {
      return
    }

    const nextPetToEdit = viewingPet
    closeViewModal()
    handleEditPet(nextPetToEdit)
  }

  const handleViewDelete = () => {
    if (!viewingPet) {
      return
    }

    handleDeletePetRequest(viewingPet)
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
          <h1 className={styles.pageTitle}>Pet List</h1>

          <div className={styles.tablePanel}>
            <div className={styles.tableScroll} ref={tableScrollRef}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Image</th>
                    <th scope="col">Pet Name</th>
                    <th scope="col">Race</th>
                    <th scope="col">Health</th>
                    <th scope="col">Available</th>
                    <th scope="col">Animal</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {isLoadingPets ? (
                    skeletonRowIndexes.map((rowIndex) => (
                      <tr key={`pet-skeleton-${rowIndex}`} aria-hidden="true">
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonImage}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonText}`} />
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
                          <div className={`${styles.skeletonBlock} ${styles.skeletonBadge}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonAction}`} />
                        </td>
                      </tr>
                    ))
                  ) : filteredPets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={styles.tableStateCell}>
                        No pets found.
                      </td>
                    </tr>
                  ) : (
                    visiblePets.map((pet) => (
                      <tr
                        key={pet.id}
                        className={styles.clickableRow}
                        onClick={() => {
                          handleViewPet(pet)
                        }}
                      >
                        <td>
                          <img
                            src={resolvePetImage(pet)}
                            alt={pet.name || `${pet.type || 'Pet'} photo`}
                            className={styles.petImage}
                          />
                        </td>
                        <td>{pet.name}</td>
                        <td>{pet.race || 'N/A'}</td>
                        <td>{pet.isVaccinated ? 'Vaccinated' : 'Not Vaccinated'}</td>
                        <td>{STATUS_LABELS[pet.status] ?? pet.status}</td>
                        <td>
                          <div className={styles.animalCell}>
                            <AnimalBadge animal={resolveAnimalFromType(pet.type)} />
                          </div>
                        </td>
                        <td>
                          <div className={styles.actionCell}>
                            <button
                              type="button"
                              className={styles.actionButton}
                              aria-label={`Edit ${pet.name}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleEditPet(pet)
                              }}
                            >
                              <FaEdit aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className={`${styles.actionButton} ${styles.deleteButton}`}
                              aria-label={`Delete ${pet.name}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleDeletePetRequest(pet)
                              }}
                              disabled={petIdBeingDeleted === pet.id}
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

              {hasMorePetsToReveal ? <div ref={loadMoreTriggerRef} className={styles.loadMoreTrigger} /> : null}
            </div>

            <button
              type="button"
              className={styles.floatingAddButton}
              aria-label="Add pet"
              onClick={() => {
                setEditingPetId(null)
                setAddPetForm(DEFAULT_ADD_PET_FORM)
                setPetNameError('')
                setAdoptionDateError('')
                setPetPhotoError('')
                setIsAddModalOpen(true)
              }}
            >
              <span className={styles.floatingAddIcon}>
                <FaPlus aria-hidden="true" />
              </span>
              <span className={styles.floatingAddLabel}>Add Pet</span>
            </button>
          </div>

          <footer className={styles.tableFooter}>
            <span className={styles.footerText}>
              Showing {visiblePets.length} of {filteredPets.length}
            </span>
          </footer>
        </section>
      </div>

      {viewingPet ? (
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
            aria-labelledby="view-pet-modal-title"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className={styles.modalHeader}>
              <h2 id="view-pet-modal-title" className={styles.modalTitle}>
                Pet Details
              </h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => {
                  closeViewModal()
                }}
                aria-label="Close pet details modal"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className={styles.viewModalBody}>
              <div className={styles.viewMedia}>
                <img
                  src={resolvePetImage(viewingPet)}
                  alt={viewingPet.name || `${viewingPet.type || 'Pet'} photo`}
                  className={styles.viewImage}
                />
                {viewingPet.videos ? (
                  <video className={styles.viewVideo} controls preload="metadata">
                    <source src={viewingPet.videos} />
                    Your browser does not support HTML video playback.
                  </video>
                ) : null}
              </div>

              <div className={styles.viewDetailsGrid}>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Name</span>
                  <span className={styles.viewDetailValue}>{viewingPet.name || 'N/A'}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Type</span>
                  <span className={styles.viewDetailValue}>
                    {viewingPet.type ? toProperNameCase(viewingPet.type) : 'N/A'}
                  </span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Race</span>
                  <span className={styles.viewDetailValue}>{viewingPet.race || 'N/A'}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Gender</span>
                  <span className={styles.viewDetailValue}>{viewingPet.gender || 'N/A'}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Status</span>
                  <span className={styles.viewDetailValue}>
                    {STATUS_LABELS[viewingPet.status] ?? viewingPet.status}
                  </span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Vaccinated</span>
                  <span className={styles.viewDetailValue}>
                    {viewingPet.isVaccinated ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Age</span>
                  <span className={styles.viewDetailValue}>{formatMeasure(viewingPet.age)}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Weight</span>
                  <span className={styles.viewDetailValue}>{formatMeasure(viewingPet.weight, 'kg')}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Height</span>
                  <span className={styles.viewDetailValue}>{formatMeasure(viewingPet.height, 'cm')}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Birth Date</span>
                  <span className={styles.viewDetailValue}>{formatDateLabel(viewingPet.birthDate)}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Rescued Date</span>
                  <span className={styles.viewDetailValue}>{formatDateLabel(viewingPet.rescuedDate)}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Adoption Date</span>
                  <span className={styles.viewDetailValue}>{formatDateLabel(viewingPet.adoptionDate)}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Adopted By</span>
                  <span className={styles.viewDetailValue}>{resolveAdoptedByLabel(viewingPet.adoptedBy)}</span>
                </div>
                <div className={`${styles.viewDetailItem} ${styles.viewDetailItemWide}`}>
                  <span className={styles.viewDetailLabel}>Description</span>
                  <p className={styles.viewDescription}>{viewingPet.description || 'N/A'}</p>
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
            aria-labelledby="add-pet-modal-title"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className={styles.modalHeader}>
              <h2 id="add-pet-modal-title" className={styles.modalTitle}>
                {editingPetId ? 'Edit Pet' : 'Add Pet'}
              </h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => {
                  closeAddModal()
                }}
                aria-label="Close add pet modal"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={handleAddPetSubmit} noValidate>
              <div className={styles.modalFields}>
                <label className={styles.fieldLabel}>
                  <span>
                    Pet Name <span className={styles.requiredAsterisk}>*</span>
                  </span>
                  <input
                    type="text"
                    value={addPetForm.name}
                    onChange={(event) => {
                      setPetNameError('')
                      setAddPetForm((currentForm) => ({
                        ...currentForm,
                        name: toProperNameCase(event.target.value),
                      }))
                    }}
                    className={`${styles.fieldInput}${petNameError ? ` ${styles.fieldInputError}` : ''}`}
                  />
                  {petNameError ? <span className={styles.fieldErrorText}>{petNameError}</span> : null}
                </label>

                <label className={styles.fieldLabel}>
                  <span>
                    Gender <span className={styles.requiredAsterisk}>*</span>
                  </span>
                  <select
                    value={addPetForm.gender}
                    onChange={(event) => {
                      setAddPetForm((currentForm) => ({ ...currentForm, gender: event.target.value }))
                    }}
                    className={styles.fieldInput}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </label>

                <label className={styles.fieldLabel}>
                  <span>
                    Type <span className={styles.requiredAsterisk}>*</span>
                  </span>
                  <select
                    value={addPetForm.type}
                    onChange={(event) => {
                      setAddPetForm((currentForm) => ({ ...currentForm, type: event.target.value }))
                    }}
                    className={styles.fieldInput}
                  >
                    <option value="Dog">Dog</option>
                    <option value="Cat">Cat</option>
                  </select>
                </label>

                <label className={styles.fieldLabel}>
                  <span>Race</span>
                  <input
                    type="text"
                    value={addPetForm.race}
                    onChange={(event) => {
                      setAddPetForm((currentForm) => ({
                        ...currentForm,
                        race: toProperNameCase(event.target.value),
                      }))
                    }}
                    className={styles.fieldInput}
                    placeholder="e.g. Golden Retriever"
                  />
                </label>

                <label className={styles.fieldLabel}>
                  <span>
                    Status <span className={styles.requiredAsterisk}>*</span>
                  </span>
                  <select
                    value={addPetForm.status}
                    onChange={(event) => {
                      const value = event.target.value as PetStatus
                      setAdoptionDateError('')
                      setAddPetForm((currentForm) => ({
                        ...currentForm,
                        adoptionDate: value === 'ADOPTED' ? currentForm.adoptionDate : '',
                        status: value,
                      }))
                    }}
                    className={styles.fieldInput}
                  >
                    <option value="AVAILABLE_FOR_ADOPTION">{STATUS_LABELS.AVAILABLE_FOR_ADOPTION}</option>
                    <option value="ONGOING_ADOPTION">{STATUS_LABELS.ONGOING_ADOPTION}</option>
                    <option value="ADOPTED">{STATUS_LABELS.ADOPTED}</option>
                    <option value="RESCUED">{STATUS_LABELS.RESCUED}</option>
                  </select>
                </label>

                <label className={`${styles.fieldLabel} ${styles.checkboxField}`}>
                  <input
                    type="checkbox"
                    checked={addPetForm.isVaccinated}
                    onChange={(event) => {
                      setAddPetForm((currentForm) => ({
                        ...currentForm,
                        isVaccinated: event.target.checked,
                      }))
                    }}
                    className={styles.checkboxInput}
                  />
                  <span>Vaccinated</span>
                </label>

                <label className={styles.fieldLabel}>
                  <span>Weight (kg)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={addPetForm.weight}
                    onChange={(event) => {
                      setAddPetForm((currentForm) => ({ ...currentForm, weight: event.target.value }))
                    }}
                    className={styles.fieldInput}
                    placeholder="e.g. 12.50"
                  />
                </label>

                <label className={styles.fieldLabel}>
                  <span>Height (cm)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={addPetForm.height}
                    onChange={(event) => {
                      setAddPetForm((currentForm) => ({ ...currentForm, height: event.target.value }))
                    }}
                    className={styles.fieldInput}
                    placeholder="e.g. 35.20"
                  />
                </label>

                <label className={styles.fieldLabel}>
                  <span>Birth Date</span>
                  <input
                    type="date"
                    max={maxBirthDate}
                    value={addPetForm.birthDate}
                    onChange={(event) => {
                      const nextBirthDate = event.target.value
                      setAddPetForm((currentForm) => ({
                        ...currentForm,
                        birthDate:
                          nextBirthDate && nextBirthDate > maxBirthDate ? maxBirthDate : nextBirthDate,
                      }))
                    }}
                    className={styles.fieldInput}
                  />
                </label>

                <label className={styles.fieldLabel}>
                  <span>Rescued Date</span>
                  <input
                    type="date"
                    value={addPetForm.rescuedDate}
                    onChange={(event) => {
                      setAddPetForm((currentForm) => ({ ...currentForm, rescuedDate: event.target.value }))
                    }}
                    className={styles.fieldInput}
                  />
                </label>

                {shouldShowAdoptionDate ? (
                  <label className={styles.fieldLabel}>
                    <span>
                      Adoption Date <span className={styles.requiredAsterisk}>*</span>
                    </span>
                    <input
                      type="date"
                      value={addPetForm.adoptionDate}
                      onChange={(event) => {
                        setAdoptionDateError('')
                        setAddPetForm((currentForm) => ({ ...currentForm, adoptionDate: event.target.value }))
                      }}
                      className={`${styles.fieldInput}${adoptionDateError ? ` ${styles.fieldInputError}` : ''}`}
                    />
                    {adoptionDateError ? <span className={styles.fieldErrorText}>{adoptionDateError}</span> : null}
                  </label>
                ) : null}

                <div className={styles.fieldLabelWide}>
                  <PhotoUploadField
                    value={addPetForm.photo}
                    onChange={(nextPhoto) => {
                      setPetPhotoError('')
                      setAddPetForm((currentForm) => ({ ...currentForm, photo: nextPhoto }))
                    }}
                    onNotify={(message, variant) => {
                      showToast(message, { variant })
                    }}
                    title="Pet Photo"
                    subtitle="Upload a clear photo from your device or camera."
                    previewAlt={addPetForm.name ? `${addPetForm.name} photo` : 'Pet photo preview'}
                    uploadFolder="pets"
                  />
                  {petPhotoError ? <span className={styles.fieldErrorText}>{petPhotoError}</span> : null}
                </div>

                <div className={styles.fieldLabelWide}>
                  <VideoUploadField
                    value={addPetForm.videos}
                    onChange={(nextVideo) => {
                      setAddPetForm((currentForm) => ({ ...currentForm, videos: nextVideo }))
                    }}
                    onNotify={(message, variant) => {
                      showToast(message, { variant })
                    }}
                    title="Pet Video"
                    subtitle="Upload or record a short pet video clip."
                    uploadFolder="pets/videos"
                    maxDurationSeconds={60}
                    maxSizeMb={30}
                  />
                </div>

                <label className={`${styles.fieldLabel} ${styles.fieldLabelWide}`}>
                  <span>Description</span>
                  <textarea
                    value={addPetForm.description}
                    onChange={(event) => {
                      setAddPetForm((currentForm) => ({ ...currentForm, description: event.target.value }))
                    }}
                    className={styles.fieldTextarea}
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
                <button type="submit" className={styles.modalSubmitButton} disabled={isSavingPet}>
                  {isSavingPet ? 'Saving...' : editingPetId ? 'Save' : 'Add Pet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={Boolean(pendingDeletePet)}
        title="Delete pet?"
        message={`Are you sure you want to delete ${pendingDeletePet?.name ?? 'this pet'}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        ariaLabel="Delete pet confirmation"
        isBusy={petIdBeingDeleted !== null}
        onCancel={() => {
          setPendingDeletePet(null)
        }}
        onConfirm={handleDeletePetConfirm}
      />
    </MainLayout>
  )
}

export default PetListPage
