import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { APP_ROUTES } from '@/app/routes/route-paths'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { getAuthSessionUserId } from '@/features/auth/utils/auth-utils'
import {
  CHAT_FILTER_OPTIONS,
  CHAT_INBOX_STALE_TIME_MS,
  CHAT_LIST_PAGE_SIZE,
} from '@/features/chat/constants/chat.constants'
import { useChatRealtime } from '@/features/chat/hooks/useChatRealtime'
import { chatService } from '@/features/chat/services/chat.service'
import type {
  ChatMessage,
  ConversationStatusFilter,
  ConversationSummary,
  InboxFilterKey,
  PaginatedConversationsResponse,
  SeenReceipt,
} from '@/features/chat/types/chat-api'
import { defaultHeaderProfile, sidebarBottomItems, sidebarLogo, sidebarMenuItems } from '@/layouts/config/navigation'
import Header from '@/layouts/Header/Header'
import MainLayout from '@/layouts/MainLayout/MainLayout'
import Sidebar from '@/layouts/Sidebar/Sidebar'
import { ApiError, getErrorMessage } from '@/shared/api/api-error'
import Toast from '@/shared/components/feedback/Toast'
import { useHeaderProfile } from '@/shared/hooks/useHeaderProfile'
import { useResponsiveSidebar } from '@/shared/hooks/useResponsiveSidebar'
import { useToast } from '@/shared/hooks/useToast'
import type { SidebarItemKey } from '@/shared/types/layout'
import ConversationList from '../components/ConversationList'
import InboxFilters from '../components/InboxFilters'
import NewConversationDialog from '../components/NewConversationDialog'
import NewConversationFab from '../components/NewConversationFab'
import InboxToolbar from '../components/InboxToolbar'
import type { UserSearchOption } from '../components/UserSearchDropdown'
import styles from './InboxPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'inbox'

interface InboxPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

const EMPTY_CONVERSATION_PAGE: PaginatedConversationsResponse = {
  content: [],
  page: 0,
  size: CHAT_LIST_PAGE_SIZE,
  totalElements: 0,
  totalPages: 1,
}

const sortConversations = (leftConversation: ConversationSummary, rightConversation: ConversationSummary) => {
  const leftDateValue = leftConversation.updatedAt || leftConversation.lastMessageAt || ''
  const rightDateValue = rightConversation.updatedAt || rightConversation.lastMessageAt || ''

  if (leftDateValue && rightDateValue) {
    return rightDateValue.localeCompare(leftDateValue)
  }

  if (rightDateValue) {
    return 1
  }

  if (leftDateValue) {
    return -1
  }

  return leftConversation.participant.displayName.localeCompare(rightConversation.participant.displayName)
}

const hasResolvedParticipant = (conversation: ConversationSummary) => {
  return conversation.participant.id !== 'unknown-user' || conversation.participant.displayName !== 'User'
}

const mergeConversation = (
  currentConversations: ConversationSummary[],
  updatedConversation: ConversationSummary,
) => {
  const hasConversation = currentConversations.some(
    (conversation) => conversation.id === updatedConversation.id,
  )

  if (!hasConversation) {
    return [updatedConversation, ...currentConversations].sort(sortConversations)
  }

  return currentConversations
    .map((conversation) =>
      conversation.id === updatedConversation.id
        ? {
            ...conversation,
            ...updatedConversation,
            participant: hasResolvedParticipant(updatedConversation)
              ? updatedConversation.participant
              : conversation.participant,
          }
        : conversation,
    )
    .sort(sortConversations)
}

const mergeConversationPages = (
  currentConversations: ConversationSummary[],
  nextConversations: ConversationSummary[],
) => {
  const map = new Map<string, ConversationSummary>()

  currentConversations.forEach((conversation) => {
    if (conversation?.id) {
      map.set(conversation.id, conversation)
    }
  })

  nextConversations.forEach((conversation) => {
    if (!conversation?.id) {
      return
    }

    const currentConversation = map.get(conversation.id)
    map.set(
      conversation.id,
      currentConversation
        ? {
            ...currentConversation,
            ...conversation,
            participant: hasResolvedParticipant(conversation)
              ? conversation.participant
              : currentConversation.participant,
          }
        : conversation,
    )
  })

  return Array.from(map.values()).sort(sortConversations)
}

const toMessagePreview = (message: ChatMessage) =>
  message.body?.trim() || message.attachment?.name || 'Attachment'

const mergeConversationFromMessage = (
  currentConversations: ConversationSummary[],
  message: ChatMessage,
): ConversationSummary[] => {
  const hasConversation = currentConversations.some(
    (conversation) => conversation.id === message.conversationId,
  )

  if (!hasConversation) {
    return currentConversations
  }

  return currentConversations
    .map((conversation) => {
      if (conversation.id !== message.conversationId) {
        return conversation
      }

      const isIncoming = message.direction === 'INCOMING'

      return {
        ...conversation,
        lastMessageAt: message.createdAt,
        lastMessagePreview: toMessagePreview(message),
        readState: isIncoming ? ('UNREAD' as const) : ('READ' as const),
        unreadCount: isIncoming ? conversation.unreadCount + 1 : conversation.unreadCount,
        updatedAt: message.createdAt,
      }
    })
    .sort(sortConversations)
}

const applySeenReceiptToConversations = (
  currentConversations: ConversationSummary[],
  receipt: SeenReceipt,
): ConversationSummary[] => {
  return currentConversations.map((conversation) => {
    if (conversation.id !== receipt.conversationId) {
      return conversation
    }

    return {
      ...conversation,
      lastMessageSeenAt: receipt.seenAt,
      readState: 'SEEN' as const,
      unreadCount: 0,
    }
  })
}

const resolveStatusFilter = (filter: InboxFilterKey): ConversationStatusFilter | undefined => {
  if (filter === 'ALL') {
    return 'ALL'
  }

  if (filter === 'STARRED') {
    return 'STARRED'
  }

  if (filter === 'UNREAD') {
    return 'UNREAD'
  }

  return undefined
}

const matchesFilter = (conversation: ConversationSummary, filter: InboxFilterKey) => {
  if (filter === 'STARRED') {
    return Boolean(conversation.isStarred)
  }

  if (filter === 'UNREAD') {
    return conversation.unreadCount > 0 || conversation.readState === 'UNREAD'
  }

  if (filter === 'READ') {
    return conversation.unreadCount === 0 && conversation.readState !== 'UNREAD'
  }

  return true
}

function InboxPage({ onLogout, session }: InboxPageProps) {
  const navigate = useNavigate()
  const { clearToast, showToast, toast } = useToast()
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const resolvedHeaderProfile = useHeaderProfile({
    fallbackProfile: defaultHeaderProfile,
    session,
  })

  const accessToken = session?.accessToken?.trim() ?? ''
  const currentUserId = getAuthSessionUserId(session?.user)

  const [headerSearchValue, setHeaderSearchValue] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [activeFilter, setActiveFilter] = useState<InboxFilterKey>('ALL')
  const [conversationPage, setConversationPage] =
    useState<PaginatedConversationsResponse>(EMPTY_CONVERSATION_PAGE)
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState(false)
  const [isDeletingSelectedConversations, setIsDeletingSelectedConversations] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isNewConversationDialogOpen, setIsNewConversationDialogOpen] = useState(false)
  const [selectedConversationIds, setSelectedConversationIds] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [totalUnreadCount, setTotalUnreadCount] = useState(0)
  const conversationCacheRef = useRef<{ fetchedAt: number; key: string }>({
    fetchedAt: 0,
    key: '',
  })
  const unreadCountCacheRef = useRef<number>(0)
  const canTriggerLoadMoreRef = useRef(true)
  const isLoadingMoreRef = useRef(false)
  const wasConnectedRef = useRef(false)

  const loadConversations = useCallback(
    async (options?: { append?: boolean; force?: boolean; page?: number; silent?: boolean }) => {
      if (!accessToken) {
        setConversationPage(EMPTY_CONVERSATION_PAGE)
        setErrorMessage('')
        conversationCacheRef.current = {
          fetchedAt: 0,
          key: '',
        }
        return
      }

      const targetPage = Math.max(0, options?.page ?? 0)
      const shouldAppend = Boolean(options?.append)
      const isSilent = Boolean(options?.silent)
      const shouldForce = Boolean(options?.force)
      const statusFilter = resolveStatusFilter(activeFilter)
      const queryKey = `${activeFilter}|${statusFilter ?? 'ALL'}|${targetPage}|${searchValue.trim().toLowerCase()}`
      const isFresh =
        !shouldForce &&
        conversationCacheRef.current.key === queryKey &&
        Date.now() - conversationCacheRef.current.fetchedAt < CHAT_INBOX_STALE_TIME_MS

      if (isFresh) {
        return
      }

      if (!isSilent) {
        setIsLoadingConversations(true)
      }

      try {
        const response = await chatService.listConversations(accessToken, {
          page: targetPage,
          search: searchValue,
          size: CHAT_LIST_PAGE_SIZE,
          status: statusFilter,
        })

        const visibleConversations = response.content.filter(
          (conversation) => conversation?.id && conversation.participant?.displayName,
        )

        setConversationPage((currentPage) => ({
          ...response,
          content: shouldAppend
            ? mergeConversationPages(currentPage.content, visibleConversations)
            : [...visibleConversations].sort(sortConversations),
        }))
        conversationCacheRef.current = {
          fetchedAt: Date.now(),
          key: queryKey,
        }
        setErrorMessage('')
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          setErrorMessage('You are not authorized to view these conversations.')
        } else {
          setErrorMessage(getErrorMessage(error))
        }
      } finally {
        if (!isSilent) {
          setIsLoadingConversations(false)
        }
      }
    },
    [accessToken, activeFilter, searchValue],
  )

  const hasMoreConversations = conversationPage.page + 1 < conversationPage.totalPages

  const loadNextConversationPage = useCallback(async () => {
    if (
      !accessToken ||
      !hasMoreConversations ||
      isLoadingConversations ||
      isLoadingMoreConversations ||
      isLoadingMoreRef.current
    ) {
      return
    }

    isLoadingMoreRef.current = true
    setIsLoadingMoreConversations(true)

    try {
      await loadConversations({
        append: true,
        page: conversationPage.page + 1,
        silent: true,
      })
    } finally {
      isLoadingMoreRef.current = false
      setIsLoadingMoreConversations(false)
    }
  }, [
    accessToken,
    conversationPage.page,
    hasMoreConversations,
    isLoadingConversations,
    isLoadingMoreConversations,
    loadConversations,
  ])

  const loadUnreadCount = useCallback(
    async (options?: { force?: boolean; silent?: boolean }) => {
      if (!accessToken) {
        setTotalUnreadCount(0)
        unreadCountCacheRef.current = 0
        return
      }

      const shouldForce = Boolean(options?.force)
      const isFresh =
        !shouldForce && Date.now() - unreadCountCacheRef.current < CHAT_INBOX_STALE_TIME_MS

      if (isFresh) {
        return
      }

      try {
        const summary = await chatService.getUnreadCount(accessToken)
        setTotalUnreadCount(summary.totalUnreadCount)
        unreadCountCacheRef.current = Date.now()
      } catch (error) {
        if (!options?.silent) {
          showToast(getErrorMessage(error), { variant: 'error' })
        }
      }
    },
    [accessToken, showToast],
  )

  useEffect(() => {
    clearToast()
    void loadConversations()
    void loadUnreadCount()
  }, [activeFilter, clearToast, loadConversations, loadUnreadCount, searchValue])

  useEffect(() => {
    setSelectedConversationIds([])
  }, [activeFilter, searchValue])

  const filteredConversations = useMemo(() => {
    const byInboxFilter = conversationPage.content.filter((conversation) =>
      matchesFilter(conversation, activeFilter),
    )
    const normalizedSearch = headerSearchValue.trim().toLowerCase()
    if (!normalizedSearch) {
      return byInboxFilter
    }

    return byInboxFilter.filter((conversation) => {
      const participantName = conversation.participant.displayName.toLowerCase()
      const preview = conversation.lastMessagePreview?.toLowerCase() ?? ''
      return participantName.includes(normalizedSearch) || preview.includes(normalizedSearch)
    })
  }, [activeFilter, conversationPage.content, headerSearchValue])

  useEffect(() => {
    const visibleConversationIds = new Set(filteredConversations.map((conversation) => conversation.id))

    setSelectedConversationIds((currentIds) => {
      const nextIds = currentIds.filter((id) => visibleConversationIds.has(id))
      return nextIds.length === currentIds.length ? currentIds : nextIds
    })
  }, [filteredConversations])

  const { isConnected } = useChatRealtime({
    enabled: Boolean(accessToken),
    onConversationUpdated: (updatedConversation) => {
      setConversationPage((currentPage) => ({
        ...currentPage,
        content: mergeConversation(currentPage.content, updatedConversation),
      }))
    },
    onMessage: (message) => {
      setConversationPage((currentPage) => ({
        ...currentPage,
        content: mergeConversationFromMessage(currentPage.content, message),
      }))
    },
    onSeenReceipt: (receipt) => {
      setConversationPage((currentPage) => ({
        ...currentPage,
        content: applySeenReceiptToConversations(currentPage.content, receipt),
      }))
    },
    onUnreadCount: (summary) => {
      setTotalUnreadCount(summary.totalUnreadCount)
    },
  })

  useEffect(() => {
    if (!accessToken) {
      wasConnectedRef.current = false
      return
    }

    if (!isConnected) {
      wasConnectedRef.current = false
      return
    }

    if (!wasConnectedRef.current) {
      void Promise.all([
        loadConversations({ force: true, silent: true }),
        loadUnreadCount({ force: true, silent: true }),
      ])
    }

    wasConnectedRef.current = true
  }, [accessToken, isConnected, loadConversations, loadUnreadCount])

  const handleOpenConversation = (conversationId: string) => {
    navigate(`${APP_ROUTES.inbox}/${conversationId}`)
  }

  const handleToggleConversationSelection = (conversationId: string) => {
    setSelectedConversationIds((currentIds) => {
      if (currentIds.includes(conversationId)) {
        return currentIds.filter((id) => id !== conversationId)
      }

      return [...currentIds, conversationId]
    })
  }

  const handleToggleStar = (conversationId: string) => {
    if (!accessToken) {
      showToast('You need to sign in to update starred conversations.', { variant: 'error' })
      return
    }

    const targetConversation = conversationPage.content.find((conversation) => conversation.id === conversationId)
    if (!targetConversation) {
      return
    }

    const nextIsStarred = !targetConversation.isStarred

    setConversationPage((currentPage) => ({
      ...currentPage,
      content: currentPage.content.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, isStarred: nextIsStarred } : conversation,
      ),
    }))

    const syncStarredState = async () => {
      try {
        await chatService.setConversationStarred(conversationId, nextIsStarred, accessToken)
      } catch (error) {
        setConversationPage((currentPage) => ({
          ...currentPage,
          content: currentPage.content.map((conversation) =>
            conversation.id === conversationId ? { ...conversation, isStarred: !nextIsStarred } : conversation,
          ),
        }))
        showToast(getErrorMessage(error), { variant: 'error' })
      }
    }

    void syncStarredState()
  }

  const handleConversationScroll = (event: UIEvent<HTMLDivElement>) => {
    const scrollContainer = event.currentTarget
    const distanceFromBottom =
      scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight

    if (distanceFromBottom > 180) {
      canTriggerLoadMoreRef.current = true
      return
    }

    if (distanceFromBottom <= 120 && canTriggerLoadMoreRef.current) {
      canTriggerLoadMoreRef.current = false
      void loadNextConversationPage()
    }
  }

  const handleCreateConversation = useCallback(
    async (selectedUser: UserSearchOption) => {
      if (!accessToken) {
        showToast('You need to sign in to create a conversation.', { variant: 'error' })
        return
      }

      try {
        const conversation = await chatService.createConversation(selectedUser.id, accessToken)
        setIsNewConversationDialogOpen(false)
        navigate(`${APP_ROUTES.inbox}/${conversation.id}`)
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      }
    },
    [accessToken, navigate, showToast],
  )

  return (
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
          <h1 className={styles.pageTitle}>Inbox</h1>

          <section className={styles.card} aria-label="Inbox conversations">
            <div className={styles.toolbarWrap}>
              <InboxToolbar
                searchValue={searchValue}
                setSearchValue={setSearchValue}
                isRefreshing={isRefreshing}
                removeDisabled={selectedConversationIds.length === 0 || isDeletingSelectedConversations}
                onRefresh={() => {
                  setIsRefreshing(true)
                  const refresh = async () => {
                    try {
                      await Promise.all([
                        loadConversations({ force: true, silent: true }),
                        loadUnreadCount({ force: true, silent: true }),
                      ])
                    } finally {
                      setIsRefreshing(false)
                    }
                  }

                  void refresh()
                }}
                onInfoClick={() => {
                  showToast(
                    isConnected
                      ? 'Realtime sync is active. Messages update automatically.'
                      : 'Realtime sync is reconnecting.',
                    { variant: 'info' },
                  )
                }}
                onRemoveClick={() => {
                  if (isDeletingSelectedConversations) {
                    return
                  }

                  if (selectedConversationIds.length === 0) {
                    showToast('Select at least one conversation to remove.', { variant: 'info' })
                    return
                  }

                  if (!accessToken) {
                    showToast('You need to sign in to delete conversations.', { variant: 'error' })
                    return
                  }

                  const selectedIds = Array.from(new Set(selectedConversationIds))
                  setIsDeletingSelectedConversations(true)

                  const removeConversations = async () => {
                    try {
                      const {
                        deletedConversationIds: succeededIds,
                        failedConversationIds,
                      } = await chatService.bulkDeleteConversations(selectedIds, accessToken)
                      const failedCount = failedConversationIds.length

                      if (succeededIds.length > 0) {
                        const succeededIdSet = new Set(succeededIds)

                        setConversationPage((currentPage) => {
                          const nextContent = currentPage.content.filter(
                            (conversation) => !succeededIdSet.has(conversation.id),
                          )

                          const removedCount = currentPage.content.length - nextContent.length
                          if (removedCount <= 0) {
                            return currentPage
                          }

                          return {
                            ...currentPage,
                            content: nextContent,
                            totalElements: Math.max(0, currentPage.totalElements - removedCount),
                          }
                        })
                      }

                      setSelectedConversationIds((currentIds) =>
                        currentIds.filter((conversationId) => !succeededIds.includes(conversationId)),
                      )
                      conversationCacheRef.current = { fetchedAt: 0, key: '' }

                      await Promise.all([
                        loadConversations({ force: true, silent: true }),
                        loadUnreadCount({ force: true, silent: true }),
                      ])

                      if (succeededIds.length === 0 && failedCount > 0) {
                        showToast('Unable to delete selected conversations.', {
                          variant: 'error',
                        })
                        return
                      }

                      if (failedCount > 0) {
                        showToast(
                          `Deleted ${succeededIds.length} conversation${succeededIds.length === 1 ? '' : 's'}. ${failedCount} failed.`,
                          { variant: 'error' },
                        )
                        return
                      }

                      showToast(
                        `Deleted ${succeededIds.length} conversation${succeededIds.length === 1 ? '' : 's'}.`,
                        { variant: 'info' },
                      )
                    } catch (error) {
                      showToast(getErrorMessage(error), { variant: 'error' })
                    } finally {
                      setIsDeletingSelectedConversations(false)
                    }
                  }

                  void removeConversations()
                }}
              />

              <InboxFilters
                activeFilter={activeFilter}
                options={CHAT_FILTER_OPTIONS}
                unreadCount={totalUnreadCount}
                onSelect={(nextFilter) => {
                  setConversationPage({ ...EMPTY_CONVERSATION_PAGE })
                  canTriggerLoadMoreRef.current = true
                  setActiveFilter(nextFilter)
                }}
              />
            </div>

            <div className={styles.listWrap}>
              <div className={styles.listScrollArea} onScroll={handleConversationScroll}>
                <ConversationList
                  conversations={filteredConversations}
                  isLoading={isLoadingConversations}
                  errorMessage={errorMessage}
                  onOpen={handleOpenConversation}
                  onToggleSelectConversation={handleToggleConversationSelection}
                  onToggleStar={handleToggleStar}
                  selectedConversationIds={selectedConversationIds}
                />
                {isLoadingMoreConversations ? (
                  <div className={styles.loadingMoreIndicator}>Loading more conversations...</div>
                ) : null}
              </div>

              <NewConversationFab
                disabled={!accessToken}
                onClick={() => {
                  setIsNewConversationDialogOpen(true)
                }}
              />
            </div>
          </section>
        </section>
      </div>
      <NewConversationDialog
        accessToken={accessToken}
        currentUserId={currentUserId || undefined}
        isOpen={isNewConversationDialogOpen}
        onClose={() => {
          setIsNewConversationDialogOpen(false)
        }}
        onCreate={handleCreateConversation}
      />
    </MainLayout>
  )
}

export default InboxPage



