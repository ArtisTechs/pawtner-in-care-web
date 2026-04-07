import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { FaEdit, FaPlus, FaTimes, FaTrashAlt } from 'react-icons/fa'
import communityFallbackImage from '@/assets/events-icon.png'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { isAdminAuthSession } from '@/features/auth/utils/auth-utils'
import {
  DEFAULT_ADD_COMMUNITY_POST_FORM,
  LIST_BATCH_SIZE,
  LIST_INITIAL_BATCH_SIZE,
  LIST_SKELETON_ROW_COUNT,
  VISIBILITY_LABELS,
  type AddCommunityPostForm,
} from '@/features/community-listing/constants/community-listing.constants'
import { communityListingService } from '@/features/community-listing/services/community-listing.service'
import type { CommunityPost } from '@/features/community-listing/types/community-listing-api'
import {
  buildCommunityPostPayload,
  formatDateLabel,
  mapCommunityPostToForm,
  resolveDisplayName,
  resolveHashtags,
  resolvePostMediaList,
  resolvePostId,
  resolvePrimaryMediaUrl,
  toCountLabel,
  toTitleCase,
} from '@/features/community-listing/utils/community-listing-form'
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
import styles from './CommunityListingPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'community-listing'
const MAX_POST_IMAGES = 5
const MIN_POST_IMAGE_SLOTS = 1

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object'

const toNormalizedId = (value: unknown) => {
  if (typeof value !== 'string') {
    return ''
  }

  const trimmedValue = value.trim()
  return trimmedValue || ''
}

const resolveSessionUserIds = (user: AuthSession['user']) => {
  const ids = new Set<string>()
  const appendId = (value: unknown) => {
    const normalizedId = toNormalizedId(value)
    if (!normalizedId) {
      return
    }

    ids.add(normalizedId)
  }

  if (!isRecord(user)) {
    return []
  }

  appendId(user.id)
  appendId(user.userId)
  appendId(user.uuid)
  appendId(user.sub)

  const nestedUser = user.user
  if (isRecord(nestedUser)) {
    appendId(nestedUser.id)
    appendId(nestedUser.userId)
    appendId(nestedUser.uuid)
    appendId(nestedUser.sub)
  }

  return Array.from(ids)
}

const resolveStatusLabel = (post: CommunityPost) => {
  if (post.hidden) {
    return 'Hidden'
  }

  const normalizedStatus = post.status?.trim().toUpperCase() || ''
  return normalizedStatus === 'DELETED' ? 'Deleted' : 'Active'
}

const resolveStatusClassName = (post: CommunityPost) => {
  if (post.hidden) {
    return styles.statusHidden
  }

  const normalizedStatus = post.status?.trim().toUpperCase() || ''
  return normalizedStatus === 'DELETED' ? styles.statusDeleted : styles.statusActive
}

const resolvePostImage = (post: CommunityPost) => {
  const photoUrl = resolvePrimaryMediaUrl(post, 'IMAGE')
  return photoUrl || communityFallbackImage
}

interface CommunityListingPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

function CommunityListingPage({ onLogout, session }: CommunityListingPageProps) {
  const { clearToast, showToast, toast } = useToast()
  const [searchValue, setSearchValue] = useState('')
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const resolvedHeaderProfile = useHeaderProfile({ fallbackProfile: defaultHeaderProfile, session })
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [isLoadingPosts, setIsLoadingPosts] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [viewingPost, setViewingPost] = useState<CommunityPost | null>(null)
  const [isLoadingPostDetails, setIsLoadingPostDetails] = useState(false)
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [isSavingPost, setIsSavingPost] = useState(false)
  const [postIdBeingDeleted, setPostIdBeingDeleted] = useState<string | null>(null)
  const [pendingDeletePost, setPendingDeletePost] = useState<{ id: string; label: string } | null>(null)
  const [postIdBeingHiddenUpdated, setPostIdBeingHiddenUpdated] = useState<string | null>(null)
  const [pendingHiddenPost, setPendingHiddenPost] = useState<{
    id: string
    label: string
    nextHidden: boolean
  } | null>(null)
  const [addPostForm, setAddPostForm] = useState<AddCommunityPostForm>(DEFAULT_ADD_COMMUNITY_POST_FORM)
  const [contentError, setContentError] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [videoError, setVideoError] = useState('')
  const [visiblePostCount, setVisiblePostCount] = useState(LIST_INITIAL_BATCH_SIZE)
  const tableScrollRef = useRef<HTMLDivElement | null>(null)
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null)
  const accessToken = session?.accessToken?.trim() ?? ''
  const currentUserIds = useMemo(() => resolveSessionUserIds(session?.user), [session?.user])
  const currentUserId = currentUserIds[0] ?? ''
  const isAdminUser = isAdminAuthSession(session)

  const isOwnPost = useCallback(
    (post: CommunityPost) => {
      const postOwnerId = post.userId?.trim() || post.user?.id?.trim() || ''
      return Boolean(postOwnerId && currentUserIds.includes(postOwnerId))
    },
    [currentUserIds],
  )

  const canEditPost = useCallback((post: CommunityPost) => isOwnPost(post), [isOwnPost])
  const canDeletePost = useCallback((post: CommunityPost) => isOwnPost(post), [isOwnPost])

  const loadPosts = useCallback(async () => {
    if (!accessToken) {
      setPosts([])
      return
    }

    setIsLoadingPosts(true)
    try {
      const postList = await communityListingService.list(
        accessToken,
        { ignorePagination: true, sortBy: 'createdAt', sortDir: 'desc' },
        currentUserId || undefined,
      )
      setPosts(Array.isArray(postList) ? postList : [])
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsLoadingPosts(false)
    }
  }, [accessToken, currentUserId, showToast])

  useEffect(() => {
    clearToast()
    void loadPosts()
  }, [clearToast, loadPosts])

  const filteredPosts = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()
    if (!normalizedSearch) {
      return posts
    }

    return posts.filter((post) => {
      const normalizedContent = post.content?.toLowerCase() ?? ''
      const normalizedVisibility = post.visibility?.toString().toLowerCase() ?? ''
      const normalizedStatus = post.status?.toString().toLowerCase() ?? ''
      const normalizedAuthor = resolveDisplayName(post).toLowerCase()
      const normalizedHashtags = resolveHashtags(post).join(' ').toLowerCase()

      return (
        normalizedContent.includes(normalizedSearch) ||
        normalizedVisibility.includes(normalizedSearch) ||
        normalizedStatus.includes(normalizedSearch) ||
        normalizedAuthor.includes(normalizedSearch) ||
        normalizedHashtags.includes(normalizedSearch)
      )
    })
  }, [posts, searchValue])

  useEffect(() => {
    setVisiblePostCount(LIST_INITIAL_BATCH_SIZE)
  }, [filteredPosts])

  const visiblePosts = useMemo(() => filteredPosts.slice(0, visiblePostCount), [filteredPosts, visiblePostCount])
  const viewingPostMedia = useMemo(
    () => (viewingPost ? resolvePostMediaList(viewingPost) : []),
    [viewingPost],
  )
  const hasMorePostsToReveal = visiblePosts.length < filteredPosts.length
  const skeletonRowIndexes = useMemo(() => Array.from({ length: LIST_SKELETON_ROW_COUNT }, (_, index) => index), [])

  useEffect(() => {
    const scrollContainer = tableScrollRef.current
    const triggerElement = loadMoreTriggerRef.current
    if (!scrollContainer || !triggerElement || isLoadingPosts || !hasMorePostsToReveal) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (!entry?.isIntersecting) {
          return
        }

        setVisiblePostCount((currentCount) => Math.min(currentCount + LIST_BATCH_SIZE, filteredPosts.length))
      },
      { root: scrollContainer, rootMargin: '120px 0px', threshold: 0.05 },
    )

    observer.observe(triggerElement)
    return () => {
      observer.disconnect()
    }
  }, [filteredPosts.length, hasMorePostsToReveal, isLoadingPosts])

  const closeAddModal = useCallback(() => {
    setIsAddModalOpen(false)
    setEditingPostId(null)
    setAddPostForm(DEFAULT_ADD_COMMUNITY_POST_FORM)
    setContentError('')
    setPhotoError('')
    setVideoError('')
  }, [])

  const closeViewModal = useCallback(() => {
    setViewingPost(null)
    setIsLoadingPostDetails(false)
  }, [])

  const handlePhotoChangeAt = (photoIndex: number, nextPhoto: string) => {
    setPhotoError('')
    setAddPostForm((currentForm) => ({
      ...currentForm,
      photos: currentForm.photos.map((photoValue, currentIndex) =>
        currentIndex === photoIndex ? nextPhoto : photoValue,
      ),
    }))
  }

  const handleAddPhotoSlot = () => {
    setAddPostForm((currentForm) => {
      if (currentForm.photos.length >= MAX_POST_IMAGES) {
        return currentForm
      }

      return {
        ...currentForm,
        photos: [...currentForm.photos, ''],
      }
    })
  }

  const handleRemovePhotoSlot = (photoIndex: number) => {
    setPhotoError('')
    setAddPostForm((currentForm) => {
      if (currentForm.photos.length <= MIN_POST_IMAGE_SLOTS) {
        return currentForm
      }

      return {
        ...currentForm,
        photos: currentForm.photos.filter((_, currentIndex) => currentIndex !== photoIndex),
      }
    })
  }

  const handleAddPostSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!accessToken) {
      showToast('You need to sign in before managing community posts.', { variant: 'error' })
      return
    }
    if (!currentUserId) {
      showToast('Unable to identify the current user for this action.', { variant: 'error' })
      return
    }

    const persistPost = async () => {
      const trimmedContent = addPostForm.content.trim()
      const trimmedVideo = addPostForm.video.trim()
      const uploadedPhotos = addPostForm.photos.map((photo) => photo.trim()).filter(Boolean)
      setContentError('')
      setPhotoError('')
      setVideoError('')

      let hasValidationError = false
      if (!trimmedContent) {
        hasValidationError = true
        setContentError('Content is required.')
      }

      if (uploadedPhotos.length === 0) {
        hasValidationError = true
        setPhotoError('At least one post image is required.')
      }

      if (uploadedPhotos.length > MAX_POST_IMAGES) {
        hasValidationError = true
        setPhotoError(`You can upload up to ${MAX_POST_IMAGES} images only.`)
      }

      if (trimmedVideo) {
        const duplicatePhotoUrl = uploadedPhotos.find((photoUrl) => photoUrl === trimmedVideo)
        if (duplicatePhotoUrl) {
          hasValidationError = true
          setVideoError('Video URL cannot be the same as an image URL.')
        }
      }

      if (hasValidationError) {
        showToast('Please complete the required fields and resolve validation errors.', { variant: 'error' })
        return
      }

      const payload = buildCommunityPostPayload(addPostForm)
      setIsSavingPost(true)
      try {
        if (editingPostId) {
          await communityListingService.update(editingPostId, payload, accessToken, currentUserId)
          showToast('Community post updated successfully.', { variant: 'success' })
        } else {
          await communityListingService.create(payload, accessToken, currentUserId)
          showToast('Community post added successfully.', { variant: 'success' })
        }

        closeAddModal()
        await loadPosts()
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setIsSavingPost(false)
      }
    }

    void persistPost()
  }

  const handleEditPost = (post: CommunityPost) => {
    if (!canEditPost(post)) {
      showToast('You can only edit your own posts.', { variant: 'error' })
      return
    }

    const postId = resolvePostId(post)
    if (!postId) {
      showToast('Unable to edit this post because its ID is missing.', { variant: 'error' })
      return
    }

    setEditingPostId(postId)
    setAddPostForm(mapCommunityPostToForm(post))
    setContentError('')
    setPhotoError('')
    setVideoError('')
    setIsAddModalOpen(true)
  }

  const handleViewPost = (post: CommunityPost) => {
    setViewingPost(post)
    const postId = resolvePostId(post)
    if (!accessToken || !postId) {
      return
    }

    const loadPostDetails = async () => {
      setIsLoadingPostDetails(true)
      try {
        const postDetails = await communityListingService.getOne(postId, accessToken, currentUserId || undefined)
        setViewingPost((currentPost) => {
          if (!currentPost || resolvePostId(currentPost) !== postId) {
            return currentPost
          }
          return postDetails
        })
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setIsLoadingPostDetails(false)
      }
    }

    void loadPostDetails()
  }

  const handleDeletePost = (postId: string) => {
    if (!accessToken) {
      setPendingDeletePost(null)
      showToast('You need to sign in before managing community posts.', { variant: 'error' })
      return
    }
    if (!currentUserId) {
      setPendingDeletePost(null)
      showToast('Unable to identify the current user for this action.', { variant: 'error' })
      return
    }

    const deletePost = async () => {
      setPostIdBeingDeleted(postId)
      try {
        await communityListingService.delete(postId, accessToken, currentUserId)
        setPosts((currentPosts) => currentPosts.filter((post) => resolvePostId(post) !== postId))
        setViewingPost((currentPost) => {
          if (!currentPost || resolvePostId(currentPost) !== postId) {
            return currentPost
          }
          return null
        })
        showToast('Community post removed successfully.', { variant: 'success' })
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setPendingDeletePost(null)
        setPostIdBeingDeleted(null)
      }
    }

    void deletePost()
  }

  const handleDeletePostRequest = (post: CommunityPost) => {
    if (!canDeletePost(post)) {
      showToast('You can only delete your own posts.', { variant: 'error' })
      return
    }

    const postId = resolvePostId(post)
    if (!postId) {
      showToast('Unable to delete this post because its ID is missing.', { variant: 'error' })
      return
    }

    setPendingDeletePost({ id: postId, label: post.content?.trim() || 'this post' })
  }

  const handleTogglePostHidden = (postId: string, nextHidden: boolean) => {
    if (!isAdminUser) {
      setPendingHiddenPost(null)
      showToast('Only admins can hide or unhide posts.', { variant: 'error' })
      return
    }

    if (!accessToken) {
      setPendingHiddenPost(null)
      showToast('You need to sign in before managing community posts.', { variant: 'error' })
      return
    }

    if (!currentUserId) {
      setPendingHiddenPost(null)
      showToast('Unable to identify the current user for this action.', { variant: 'error' })
      return
    }

    const togglePostHidden = async () => {
      setPostIdBeingHiddenUpdated(postId)

      try {
        const updatedPost = await communityListingService.setHidden(
          postId,
          nextHidden,
          accessToken,
          currentUserId,
        )

        setPosts((currentPosts) =>
          currentPosts.map((post) => {
            if (resolvePostId(post) !== postId) {
              return post
            }

            return {
              ...post,
              ...updatedPost,
              hidden: updatedPost.hidden ?? nextHidden,
            }
          }),
        )

        setViewingPost((currentPost) => {
          if (!currentPost || resolvePostId(currentPost) !== postId) {
            return currentPost
          }

          return {
            ...currentPost,
            ...updatedPost,
            hidden: updatedPost.hidden ?? nextHidden,
          }
        })

        showToast(nextHidden ? 'Post hidden successfully.' : 'Post unhidden successfully.', {
          variant: 'success',
        })
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setPendingHiddenPost(null)
        setPostIdBeingHiddenUpdated(null)
      }
    }

    void togglePostHidden()
  }

  const handleTogglePostHiddenRequest = (post: CommunityPost) => {
    if (!isAdminUser) {
      showToast('Only admins can hide or unhide posts.', { variant: 'error' })
      return
    }

    const postId = resolvePostId(post)
    if (!postId) {
      showToast('Unable to update visibility for this post because its ID is missing.', {
        variant: 'error',
      })
      return
    }

    setPendingHiddenPost({
      id: postId,
      label: post.content?.trim() || 'this post',
      nextHidden: !Boolean(post.hidden),
    })
  }

  const handleViewEdit = () => {
    if (!viewingPost) {
      return
    }

    if (!canEditPost(viewingPost)) {
      showToast('You can only edit your own posts.', { variant: 'error' })
      return
    }

    const nextPostToEdit = viewingPost
    closeViewModal()
    handleEditPost(nextPostToEdit)
  }

  const handleViewDelete = () => {
    if (!viewingPost) {
      return
    }

    if (!canDeletePost(viewingPost)) {
      showToast('You can only delete your own posts.', { variant: 'error' })
      return
    }

    handleDeletePostRequest(viewingPost)
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
          <h1 className={styles.pageTitle}>Community Listing</h1>

          <div className={styles.tablePanel}>
            <div className={styles.tableScroll} ref={tableScrollRef}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Image</th>
                    <th scope="col">Posted By</th>
                    <th scope="col">Content</th>
                    <th scope="col">Like / Comment</th>
                    <th scope="col">Status</th>
                    <th scope="col">Updated Date</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingPosts ? (
                    skeletonRowIndexes.map((rowIndex) => (
                      <tr key={`community-post-skeleton-${rowIndex}`} aria-hidden="true">
                        <td><div className={`${styles.skeletonBlock} ${styles.skeletonImage}`} /></td>
                        <td><div className={`${styles.skeletonBlock} ${styles.skeletonText}`} /></td>
                        <td><div className={`${styles.skeletonBlock} ${styles.skeletonTextWide}`} /></td>
                        <td><div className={`${styles.skeletonBlock} ${styles.skeletonText}`} /></td>
                        <td><div className={`${styles.skeletonBlock} ${styles.skeletonBadge}`} /></td>
                        <td><div className={`${styles.skeletonBlock} ${styles.skeletonTextWide}`} /></td>
                        <td><div className={`${styles.skeletonBlock} ${styles.skeletonAction}`} /></td>
                      </tr>
                    ))
                  ) : filteredPosts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={styles.tableStateCell}>No community posts found.</td>
                    </tr>
                  ) : (
                    visiblePosts.map((post, index) => {
                      const postId = resolvePostId(post) || `community-post-${index}`
                      const canEdit = canEditPost(post)
                      const canDelete = canDeletePost(post)
                      const isPostHideUpdateBusy = postIdBeingHiddenUpdated === resolvePostId(post)

                      return (
                        <tr key={postId} className={styles.clickableRow} onClick={() => handleViewPost(post)}>
                          <td>
                            <img src={resolvePostImage(post)} alt={post.content?.trim() || 'Community post'} className={styles.petImage} />
                          </td>
                          <td>{resolveDisplayName(post)}</td>
                          <td>{post.content?.trim() || 'N/A'}</td>
                          <td>{`${toCountLabel(post.likeCount)} / ${toCountLabel(post.commentCount)}`}</td>
                          <td>
                            <span className={`${styles.statusBadge} ${resolveStatusClassName(post)}`}>
                              {resolveStatusLabel(post)}
                            </span>
                          </td>
                          <td>{formatDateLabel(post.updatedAt || post.createdAt)}</td>
                          <td>
                            <div className={styles.actionCell}>
                              {canEdit ? (
                                <button
                                  type="button"
                                  className={styles.actionButton}
                                  aria-label={`Edit ${post.content || 'community post'}`}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleEditPost(post)
                                  }}
                                >
                                  <FaEdit aria-hidden="true" />
                                </button>
                              ) : null}

                              {canDelete ? (
                                <button
                                  type="button"
                                  className={`${styles.actionButton} ${styles.deleteButton}`}
                                  aria-label={`Delete ${post.content || 'community post'}`}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleDeletePostRequest(post)
                                  }}
                                  disabled={postIdBeingDeleted === resolvePostId(post)}
                                >
                                  <FaTrashAlt aria-hidden="true" />
                                </button>
                              ) : null}

                              {isAdminUser ? (
                                <button
                                  type="button"
                                  className={`${styles.actionButton} ${styles.actionTextButton}`}
                                  aria-label={`${post.hidden ? 'Unhide' : 'Hide'} ${post.content || 'community post'}`}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleTogglePostHiddenRequest(post)
                                  }}
                                  disabled={isPostHideUpdateBusy}
                                >
                                  {post.hidden ? 'Unhide' : 'Hide'}
                                </button>
                              ) : null}

                              {!canEdit && !canDelete && !isAdminUser ? (
                                <span className={styles.actionUnavailable}>No Access</span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
              {hasMorePostsToReveal ? <div ref={loadMoreTriggerRef} className={styles.loadMoreTrigger} /> : null}
            </div>

            <button
              type="button"
              className={styles.floatingAddButton}
              aria-label="Add community post"
              onClick={() => {
                setEditingPostId(null)
                setAddPostForm(DEFAULT_ADD_COMMUNITY_POST_FORM)
                setContentError('')
                setPhotoError('')
                setVideoError('')
                setIsAddModalOpen(true)
              }}
            >
              <span className={styles.floatingAddIcon}><FaPlus aria-hidden="true" /></span>
              <span className={styles.floatingAddLabel}>Add Post</span>
            </button>
          </div>

          <footer className={styles.tableFooter}>
            <span className={styles.footerText}>Showing {visiblePosts.length} of {filteredPosts.length}</span>
          </footer>
        </section>
      </div>

      {viewingPost ? (
        <div className={styles.modalOverlay} onClick={closeViewModal}>
          <div
            className={`${styles.modalCard} ${styles.viewModalCard}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-community-post-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 id="view-community-post-modal-title" className={styles.modalTitle}>Community Post Details</h2>
              <button type="button" className={styles.modalCloseButton} onClick={closeViewModal} aria-label="Close community post details modal">
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            {isLoadingPostDetails ? <p className={styles.viewLoadingText}>Refreshing post details...</p> : null}

            <div className={styles.viewModalBody}>
              <div className={`${styles.viewMedia} ${viewingPostMedia.length <= 1 ? styles.viewMediaSingle : ''}`}>
                {viewingPostMedia.length > 0 ? (
                  viewingPostMedia.map((mediaItem, mediaIndex) =>
                    mediaItem.mediaType === 'VIDEO' ? (
                      <video
                        key={`view-media-video-${mediaIndex}`}
                        className={styles.viewVideo}
                        controls
                        preload="metadata"
                      >
                        <source src={mediaItem.mediaUrl} />
                        Your browser does not support HTML video playback.
                      </video>
                    ) : (
                      <img
                        key={`view-media-image-${mediaIndex}`}
                        src={mediaItem.mediaUrl}
                        alt={viewingPost.content?.trim() || 'Community post'}
                        className={styles.viewImage}
                      />
                    ),
                  )
                ) : (
                  <img
                    src={resolvePostImage(viewingPost)}
                    alt={viewingPost.content?.trim() || 'Community post'}
                    className={styles.viewImage}
                  />
                )}
              </div>

              <div className={styles.viewDetailsGrid}>
                <div className={styles.viewDetailItem}><span className={styles.viewDetailLabel}>Author</span><span className={styles.viewDetailValue}>{resolveDisplayName(viewingPost)}</span></div>
                <div className={styles.viewDetailItem}><span className={styles.viewDetailLabel}>Visibility</span><span className={styles.viewDetailValue}>{VISIBILITY_LABELS[viewingPost.visibility === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC']}</span></div>
                <div className={styles.viewDetailItem}><span className={styles.viewDetailLabel}>Status</span><span className={styles.viewDetailValue}>{resolveStatusLabel(viewingPost)}</span></div>
                <div className={styles.viewDetailItem}><span className={styles.viewDetailLabel}>Hidden</span><span className={styles.viewDetailValue}>{viewingPost.hidden ? 'Yes' : 'No'}</span></div>
                <div className={styles.viewDetailItem}><span className={styles.viewDetailLabel}>Likes</span><span className={styles.viewDetailValue}>{toCountLabel(viewingPost.likeCount)}</span></div>
                <div className={styles.viewDetailItem}><span className={styles.viewDetailLabel}>Comments</span><span className={styles.viewDetailValue}>{toCountLabel(viewingPost.commentCount)}</span></div>
                <div className={styles.viewDetailItem}><span className={styles.viewDetailLabel}>Created Date</span><span className={styles.viewDetailValue}>{formatDateLabel(viewingPost.createdAt)}</span></div>
                <div className={styles.viewDetailItem}><span className={styles.viewDetailLabel}>Updated Date</span><span className={styles.viewDetailValue}>{formatDateLabel(viewingPost.updatedAt)}</span></div>
                <div className={styles.viewDetailItem}><span className={styles.viewDetailLabel}>Hashtags</span><span className={styles.viewDetailValue}>{resolveHashtags(viewingPost).join(', ') || 'N/A'}</span></div>
                <div className={`${styles.viewDetailItem} ${styles.viewDetailItemWide}`}><span className={styles.viewDetailLabel}>Content</span><p className={styles.viewDescription}>{viewingPost.content || 'N/A'}</p></div>
              </div>
            </div>

            <div className={`${styles.modalActions} ${styles.viewModalActions}`}>
              <button type="button" className={styles.modalCancelButton} onClick={closeViewModal}>Close</button>
              {canEditPost(viewingPost) ? (
                <button type="button" className={styles.modalSubmitButton} onClick={handleViewEdit}>Edit</button>
              ) : null}
              {canDeletePost(viewingPost) ? (
                <button type="button" className={`${styles.modalSubmitButton} ${styles.viewDeleteButton}`} onClick={handleViewDelete}>Delete</button>
              ) : null}
              {isAdminUser ? (
                <button
                  type="button"
                  className={styles.modalSubmitButton}
                  onClick={() => {
                    handleTogglePostHiddenRequest(viewingPost)
                  }}
                  disabled={postIdBeingHiddenUpdated === resolvePostId(viewingPost)}
                >
                  {viewingPost.hidden ? 'Unhide' : 'Hide'}
                </button>
              ) : null}
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
            aria-labelledby="add-community-post-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 id="add-community-post-modal-title" className={styles.modalTitle}>{editingPostId ? 'Edit Community Post' : 'Add Community Post'}</h2>
              <button type="button" className={styles.modalCloseButton} onClick={closeAddModal} aria-label="Close add community post modal">
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={handleAddPostSubmit} noValidate>
              <div className={styles.modalFields}>
                <label className={`${styles.fieldLabel} ${styles.fieldLabelWide}`}>
                  <span>
                    Content <span className={styles.requiredAsterisk}>*</span>
                  </span>
                  <textarea
                    value={addPostForm.content}
                    onChange={(event) => {
                      setContentError('')
                      setAddPostForm((currentForm) => ({ ...currentForm, content: toTitleCase(event.target.value) }))
                    }}
                    className={`${styles.fieldTextarea}${contentError ? ` ${styles.fieldInputError}` : ''}`}
                    rows={3}
                  />
                  {contentError ? <span className={styles.fieldErrorText}>{contentError}</span> : null}
                </label>

                <label className={styles.fieldLabel}>
                  <span>
                    Visibility <span className={styles.requiredAsterisk}>*</span>
                  </span>
                  <select
                    value={addPostForm.visibility}
                    onChange={(event) => {
                      setAddPostForm((currentForm) => ({
                        ...currentForm,
                        visibility: event.target.value === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
                      }))
                    }}
                    className={styles.fieldInput}
                  >
                    <option value="PUBLIC">{VISIBILITY_LABELS.PUBLIC}</option>
                    <option value="PRIVATE">{VISIBILITY_LABELS.PRIVATE}</option>
                  </select>
                </label>

                <label className={styles.fieldLabel}>
                  <span>Hashtags (comma-separated)</span>
                  <input
                    type="text"
                    value={addPostForm.hashtags}
                    onChange={(event) => {
                      setAddPostForm((currentForm) => ({ ...currentForm, hashtags: event.target.value }))
                    }}
                    className={styles.fieldInput}
                    placeholder="petcare, adoption"
                  />
                </label>

                <div className={styles.fieldLabelWide}>
                  <div className={styles.mediaGroupHeader}>
                    <span className={styles.mediaGroupTitle}>
                      Post Images <span className={styles.requiredAsterisk}>*</span>
                    </span>
                    <button
                      type="button"
                      className={styles.mediaGroupButton}
                      onClick={handleAddPhotoSlot}
                      disabled={addPostForm.photos.length >= MAX_POST_IMAGES}
                    >
                      Add Image ({addPostForm.photos.length}/{MAX_POST_IMAGES})
                    </button>
                  </div>
                  <div className={styles.photoSlots}>
                    {addPostForm.photos.map((photoValue, photoIndex) => (
                      <div key={`community-photo-slot-${photoIndex}`} className={styles.photoSlotCard}>
                        <PhotoUploadField
                          value={photoValue}
                          onChange={(nextPhoto) => {
                            handlePhotoChangeAt(photoIndex, nextPhoto)
                          }}
                          onNotify={(message, variant) => showToast(message, { variant })}
                          title={`Post Image ${photoIndex + 1}${photoIndex === 0 ? ' *' : ''}`}
                          subtitle="Upload a community post image from your device or camera."
                          previewAlt={
                            addPostForm.content
                              ? `${addPostForm.content} image ${photoIndex + 1}`
                              : `Community post image ${photoIndex + 1} preview`
                          }
                          uploadFolder="community-posts"
                        />
                        {addPostForm.photos.length > MIN_POST_IMAGE_SLOTS ? (
                          <button
                            type="button"
                            className={styles.removePhotoSlotButton}
                            onClick={() => {
                              handleRemovePhotoSlot(photoIndex)
                            }}
                            aria-label={`Remove image slot ${photoIndex + 1}`}
                          >
                            Remove Image
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {photoError ? <span className={styles.fieldErrorText}>{photoError}</span> : null}
                </div>

                <div className={styles.fieldLabelWide}>
                  <VideoUploadField
                    value={addPostForm.video}
                    onChange={(nextVideo) => {
                      setVideoError('')
                      setAddPostForm((currentForm) => ({ ...currentForm, video: nextVideo }))
                    }}
                    onNotify={(message, variant) => showToast(message, { variant })}
                    title="Post Video"
                    subtitle="Upload or record an optional community post video."
                    uploadFolder="community-posts/videos"
                    maxDurationSeconds={90}
                    maxSizeMb={40}
                  />
                  {videoError ? <span className={styles.fieldErrorText}>{videoError}</span> : null}
                </div>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.modalCancelButton} onClick={closeAddModal}>Cancel</button>
                <button type="submit" className={styles.modalSubmitButton} disabled={isSavingPost}>
                  {isSavingPost ? 'Saving...' : editingPostId ? 'Save' : 'Add Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={Boolean(pendingDeletePost)}
        title="Delete community post?"
        message={`Are you sure you want to delete ${pendingDeletePost?.label ?? 'this community post'}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        ariaLabel="Delete community post confirmation"
        isBusy={postIdBeingDeleted !== null}
        onCancel={() => setPendingDeletePost(null)}
        onConfirm={() => {
          if (!pendingDeletePost) {
            return
          }

          handleDeletePost(pendingDeletePost.id)
        }}
      />

      <ConfirmModal
        isOpen={Boolean(pendingHiddenPost)}
        title={pendingHiddenPost?.nextHidden ? 'Hide community post?' : 'Unhide community post?'}
        message={
          pendingHiddenPost?.nextHidden
            ? `Are you sure you want to hide ${pendingHiddenPost.label}?`
            : `Are you sure you want to unhide ${pendingHiddenPost?.label ?? 'this community post'}?`
        }
        confirmLabel={pendingHiddenPost?.nextHidden ? 'Hide' : 'Unhide'}
        cancelLabel="Cancel"
        ariaLabel="Toggle community post hidden status confirmation"
        isBusy={postIdBeingHiddenUpdated !== null}
        onCancel={() => setPendingHiddenPost(null)}
        onConfirm={() => {
          if (!pendingHiddenPost) {
            return
          }

          handleTogglePostHidden(pendingHiddenPost.id, pendingHiddenPost.nextHidden)
        }}
      />
    </MainLayout>
  )
}

export default CommunityListingPage
