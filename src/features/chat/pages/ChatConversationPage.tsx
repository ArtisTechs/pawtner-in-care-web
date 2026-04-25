import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { APP_ROUTES } from '@/app/routes/route-paths'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { getAuthSessionUserId } from '@/features/auth/utils/auth-utils'
import { CHAT_MESSAGE_MAX_LENGTH, CHAT_MESSAGE_PAGE_SIZE } from '@/features/chat/constants/chat.constants'
import { useChatRealtime } from '@/features/chat/hooks/useChatRealtime'
import { chatRealtimeService } from '@/features/chat/services/chat-realtime.service'
import { chatService } from '@/features/chat/services/chat.service'
import type {
  ChatMessage,
  ConversationDetail,
  PaginatedMessagesResponse,
  SeenReceipt,
  SendMessagePayload,
} from '@/features/chat/types/chat-api'
import { defaultHeaderProfile, sidebarBottomItems, sidebarLogo, sidebarMenuItems } from '@/layouts/config/navigation'
import Header from '@/layouts/Header/Header'
import MainLayout from '@/layouts/MainLayout/MainLayout'
import Sidebar from '@/layouts/Sidebar/Sidebar'
import { ApiError, getErrorMessage } from '@/shared/api/api-error'
import { cloudinaryService } from '@/shared/api/cloudinary.service'
import Toast from '@/shared/components/feedback/Toast'
import { useHeaderProfile } from '@/shared/hooks/useHeaderProfile'
import { useResponsiveSidebar } from '@/shared/hooks/useResponsiveSidebar'
import { useToast } from '@/shared/hooks/useToast'
import type { SidebarItemKey } from '@/shared/types/layout'
import ChatComposer from '../components/ChatComposer'
import ChatHeader from '../components/ChatHeader'
import MessageList from '../components/MessageList'
import styles from './ChatConversationPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'inbox'

interface ChatConversationPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

interface DraftConversationRouteState {
  draftConversation?: {
    participant?: {
      avatarUrl?: string | null
      displayName?: string | null
      id?: string | null
    }
  }
}

interface UploadedAttachment {
  file: File
  url: string
}

const EMPTY_MESSAGES_PAGE: PaginatedMessagesResponse = {
  content: [],
  page: 0,
  size: CHAT_MESSAGE_PAGE_SIZE,
  totalElements: 0,
  totalPages: 1,
}

const OPTIMISTIC_MESSAGE_ID_PREFIX = 'temp-'
const OPTIMISTIC_RECONCILE_WINDOW_MS = 2 * 60 * 1000
const POST_SEND_REFRESH_DELAY_MS = 500

const sortMessages = (leftMessage: ChatMessage, rightMessage: ChatMessage) => {
  return leftMessage.createdAt.localeCompare(rightMessage.createdAt)
}

const mergeMessages = (currentMessages: ChatMessage[], nextMessages: ChatMessage[]) => {
  const map = new Map<string, ChatMessage>()

  currentMessages.forEach((message) => {
    map.set(message.id, message)
  })

  nextMessages.forEach((message) => {
    const currentMessage = map.get(message.id)
    map.set(message.id, currentMessage ? { ...currentMessage, ...message } : message)
  })

  return Array.from(map.values()).sort(sortMessages)
}

const applySeenReceiptToMessages = (messages: ChatMessage[], receipt: SeenReceipt): ChatMessage[] => {
  return messages.map((message) => {
    if (message.direction !== 'OUTGOING') {
      return message
    }

    return {
      ...message,
      readState: 'SEEN' as const,
      seenAt: receipt.seenAt,
    }
  })
}

const resolveTimestamp = (value: string) => {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? null : timestamp
}

const reconcileOptimisticOutgoingMessage = (
  messages: ChatMessage[],
  nextMessage: ChatMessage,
  currentUserId: string,
) => {
  if (nextMessage.direction !== 'OUTGOING' && nextMessage.sender.id !== currentUserId) {
    return null
  }

  const normalizedBody = (nextMessage.body || '').trim()
  if (!normalizedBody) {
    return null
  }

  const nextMessageTimestamp = resolveTimestamp(nextMessage.createdAt)

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]

    if (!message.id.startsWith(OPTIMISTIC_MESSAGE_ID_PREFIX)) {
      continue
    }

    if (message.direction !== 'OUTGOING') {
      continue
    }

    if ((message.body || '').trim() !== normalizedBody) {
      continue
    }

    if (nextMessageTimestamp !== null) {
      const optimisticTimestamp = resolveTimestamp(message.createdAt)
      if (
        optimisticTimestamp !== null &&
        Math.abs(nextMessageTimestamp - optimisticTimestamp) > OPTIMISTIC_RECONCILE_WINDOW_MS
      ) {
        continue
      }
    }

    const reconciledMessages = [...messages]
    reconciledMessages[index] = {
      ...message,
      ...nextMessage,
    }
    return reconciledMessages
  }

  return null
}

function ChatConversationPage({ onLogout, session }: ChatConversationPageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { conversationId } = useParams<{ conversationId: string }>()
  const { clearToast, showToast, toast } = useToast()
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const resolvedHeaderProfile = useHeaderProfile({
    fallbackProfile: defaultHeaderProfile,
    session,
  })

  const accessToken = session?.accessToken?.trim() ?? ''
  const currentUserId = getAuthSessionUserId(session?.user) || ''

  const [headerSearchValue, setHeaderSearchValue] = useState('')
  const [conversationDetail, setConversationDetail] = useState<ConversationDetail | null>(null)
  const [messagesPage, setMessagesPage] = useState<PaginatedMessagesResponse>(EMPTY_MESSAGES_PAGE)
  const [isLoadingConversation, setIsLoadingConversation] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const [messageDraft, setMessageDraft] = useState('')
  const [attachedAttachment, setAttachedAttachment] = useState<UploadedAttachment | null>(null)
  const [forceScrollToBottomSignal, setForceScrollToBottomSignal] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const latestSeenRequestRef = useRef<string>('')
  const optimisticMessageCounterRef = useRef(0)
  const wasConnectedRef = useRef(false)
  const postSendRefreshTimeoutIdRef = useRef<number | null>(null)
  const routeState = (location.state as DraftConversationRouteState | null) ?? null

  const draftParticipant = useMemo(() => {
    return routeState?.draftConversation?.participant ?? null
  }, [routeState])

  const isDraftConversation = useMemo(() => {
    return Boolean(conversationId && conversationId.startsWith('draft-'))
  }, [conversationId])

  const draftConversationDetail = useMemo<ConversationDetail | null>(() => {
    if (!conversationId || !isDraftConversation) {
      return null
    }

    const participantId = draftParticipant?.id?.trim() || conversationId.replace('draft-', '').trim()
    const participantName = draftParticipant?.displayName?.trim() || 'New conversation'

    return {
      folder: 'INBOX',
      id: conversationId,
      participant: {
        avatarUrl: draftParticipant?.avatarUrl ?? null,
        displayName: participantName,
        id: participantId || 'draft-user',
      },
      permissions: {
        canSend: true,
        canView: true,
      },
      readState: 'READ',
      unreadCount: 0,
    }
  }, [conversationId, draftParticipant, isDraftConversation])

  const draftParticipantId = useMemo(() => {
    if (!conversationId || !isDraftConversation) {
      return ''
    }

    return draftParticipant?.id?.trim() || conversationId.replace('draft-', '').trim()
  }, [conversationId, draftParticipant, isDraftConversation])

  const forceScrollToBottom = useCallback(() => {
    setForceScrollToBottomSignal((currentValue) => currentValue + 1)
  }, [])

  const loadConversation = useCallback(async (options?: { silent?: boolean }) => {
    if (isDraftConversation) {
      setConversationDetail(draftConversationDetail)
      setErrorMessage('')
      return
    }

    if (!accessToken || !conversationId) {
      setConversationDetail(null)
      return
    }

    const isSilent = Boolean(options?.silent)
    if (!isSilent) {
      setIsLoadingConversation(true)
    }

    try {
      const detail = await chatService.getConversation(conversationId, accessToken)
      setConversationDetail(detail)
      setErrorMessage('')
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setErrorMessage('You are not authorized to view this conversation.')
      } else {
        setErrorMessage(getErrorMessage(error))
      }
    } finally {
      if (!isSilent) {
        setIsLoadingConversation(false)
      }
    }
  }, [accessToken, conversationId, draftConversationDetail, isDraftConversation])

  const loadMessages = useCallback(async (options?: { silent?: boolean }) => {
    if (isDraftConversation) {
      setMessagesPage(EMPTY_MESSAGES_PAGE)
      setErrorMessage('')
      return
    }

    if (!accessToken || !conversationId) {
      setMessagesPage(EMPTY_MESSAGES_PAGE)
      return
    }

    const isSilent = Boolean(options?.silent)
    if (!isSilent) {
      setIsLoadingMessages(true)
    }

    try {
      const response = await chatService.listMessages(
        conversationId,
        accessToken,
        {
          page: 0,
          sortDir: 'desc',
          size: CHAT_MESSAGE_PAGE_SIZE,
        },
        {
          currentUserId,
        },
      )

      setMessagesPage({
        ...response,
        content: [...response.content].sort(sortMessages),
      })
      setErrorMessage('')
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setErrorMessage('You are not authorized to read messages in this conversation.')
      } else {
        setErrorMessage(getErrorMessage(error))
      }
    } finally {
      if (!isSilent) {
        setIsLoadingMessages(false)
      }
    }
  }, [accessToken, conversationId, currentUserId, isDraftConversation])

  const scheduleMessagesRefresh = useCallback(() => {
    if (postSendRefreshTimeoutIdRef.current !== null) {
      window.clearTimeout(postSendRefreshTimeoutIdRef.current)
    }

    postSendRefreshTimeoutIdRef.current = window.setTimeout(() => {
      postSendRefreshTimeoutIdRef.current = null
      void loadMessages({ silent: true })
    }, POST_SEND_REFRESH_DELAY_MS)
  }, [loadMessages])

  useEffect(() => {
    clearToast()
    void loadConversation()
    void loadMessages()
  }, [clearToast, loadConversation, loadMessages])

  useEffect(() => {
    if (!accessToken || !conversationId || isDraftConversation) {
      return
    }

    chatRealtimeService.reconnect()
  }, [accessToken, conversationId, isDraftConversation])

  useEffect(() => {
    if (!isDraftConversation || !accessToken || !draftParticipantId) {
      return
    }

    let isActive = true

    const resolveDraftConversation = async () => {
      try {
        const conversation = await chatService.createConversation(draftParticipantId, accessToken)
        if (!isActive) {
          return
        }

        navigate(`${APP_ROUTES.inbox}/${conversation.id}`, { replace: true })
      } catch (error) {
        if (!isActive) {
          return
        }

        showToast(getErrorMessage(error), { variant: 'error' })
      }
    }

    void resolveDraftConversation()

    return () => {
      isActive = false
    }
  }, [accessToken, draftParticipantId, isDraftConversation, navigate, showToast])

  const { isConnected, sendMessage: sendRealtimeMessage, sendSeen } = useChatRealtime({
    enabled: Boolean(accessToken && conversationId && !isDraftConversation),
    onMessage: (nextMessage) => {
      if (nextMessage.conversationId !== conversationId) {
        return
      }

      setMessagesPage((currentPage) => ({
        ...currentPage,
        content:
          reconcileOptimisticOutgoingMessage(currentPage.content, nextMessage, currentUserId) ??
          mergeMessages(currentPage.content, [nextMessage]),
      }))
    },
    onSeenReceipt: (receipt) => {
      if (receipt.conversationId !== conversationId) {
        return
      }

      setMessagesPage((currentPage) => ({
        ...currentPage,
        content: applySeenReceiptToMessages(currentPage.content, receipt),
      }))
    },
    onConversationUpdated: (updatedConversation) => {
      if (updatedConversation.id !== conversationId) {
        return
      }

      setConversationDetail((currentDetail) => {
        if (!currentDetail) {
          return currentDetail
        }

        const hasResolvedParticipant =
          updatedConversation.participant.id !== 'unknown-user' ||
          updatedConversation.participant.displayName !== 'User'

        return {
          ...currentDetail,
          ...updatedConversation,
          participant: hasResolvedParticipant
            ? updatedConversation.participant
            : currentDetail.participant,
        }
      })

      scheduleMessagesRefresh()
    },
  })

  const markConversationSeen = useCallback(async () => {
    if (isDraftConversation || !accessToken || !conversationId) {
      return
    }

    const sent = sendSeen({
      conversationId,
    })

    if (sent) {
      return null
    }

    try {
      const receipt = await chatService.markConversationSeen(conversationId, accessToken)
      setMessagesPage((currentPage) => ({
        ...currentPage,
        content: applySeenReceiptToMessages(currentPage.content, receipt),
      }))
      return receipt
    } catch {
      return null
    }
  }, [accessToken, conversationId, isDraftConversation, sendSeen])

  useEffect(() => {
    if (!accessToken || !conversationId || isDraftConversation) {
      wasConnectedRef.current = false
      return
    }

    if (!isConnected) {
      wasConnectedRef.current = false
      return
    }

    if (!wasConnectedRef.current) {
      void loadConversation({ silent: true })
      void loadMessages({ silent: true })
    }

    wasConnectedRef.current = true
  }, [accessToken, conversationId, isConnected, isDraftConversation, loadConversation, loadMessages])

  useEffect(() => {
    latestSeenRequestRef.current = ''
  }, [conversationId])

  useEffect(() => {
    return () => {
      if (postSendRefreshTimeoutIdRef.current !== null) {
        window.clearTimeout(postSendRefreshTimeoutIdRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isDraftConversation) {
      return
    }

    const latestIncomingMessage = [...messagesPage.content]
      .reverse()
      .find((message) => message.direction === 'INCOMING' && message.readState !== 'SEEN')

    if (!latestIncomingMessage || latestSeenRequestRef.current === latestIncomingMessage.id) {
      return
    }

    latestSeenRequestRef.current = latestIncomingMessage.id

    const markSeen = async () => {
      await markConversationSeen()
    }

    void markSeen()
  }, [isDraftConversation, markConversationSeen, messagesPage.content])

  const hasOlderMessages = messagesPage.page + 1 < messagesPage.totalPages

  const handleLoadOlderMessages = async () => {
    if (isDraftConversation || !accessToken || !conversationId || !hasOlderMessages || isLoadingOlderMessages) {
      return
    }

    setIsLoadingOlderMessages(true)

    try {
      const nextPageIndex = messagesPage.page + 1
      const response = await chatService.listMessages(
        conversationId,
        accessToken,
        {
          page: nextPageIndex,
          sortDir: 'desc',
          size: CHAT_MESSAGE_PAGE_SIZE,
        },
        {
          currentUserId,
        },
      )

      setMessagesPage((currentPage) => ({
        ...response,
        content: mergeMessages(currentPage.content, response.content),
      }))
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsLoadingOlderMessages(false)
    }
  }

  const handleSendMessage = () => {
    if (isDraftConversation) {
      showToast('Preparing conversation. Please try again in a moment.', {
        variant: 'info',
      })
      return
    }

    if (!accessToken || !conversationId) {
      return
    }

    if (isUploadingAttachment) {
      showToast('Please wait for attachment upload to finish.', { variant: 'info' })
      return
    }

    const text = messageDraft.trim()
    if (!text && !attachedAttachment) {
      return
    }

    if (text.length > CHAT_MESSAGE_MAX_LENGTH) {
      showToast(`Message can only be up to ${CHAT_MESSAGE_MAX_LENGTH} characters.`, {
        variant: 'info',
      })
      return
    }

    const nextAttachedAttachment = attachedAttachment
    const nextAttachedFile = nextAttachedAttachment?.file ?? null

    optimisticMessageCounterRef.current += 1
    const optimisticMessageId = `${OPTIMISTIC_MESSAGE_ID_PREFIX}${Date.now()}-${optimisticMessageCounterRef.current}`
    const createdAt = new Date().toISOString()
    const optimisticMessage: ChatMessage = {
      attachment: nextAttachedFile
        ? {
            mimeType: nextAttachedFile.type,
            name: nextAttachedFile.name,
            size: nextAttachedFile.size,
            url: null,
          }
        : null,
      body: text,
      conversationId,
      createdAt,
      direction: 'OUTGOING',
      id: optimisticMessageId,
      readState: 'SENT',
      sender: {
        displayName: resolvedHeaderProfile.name,
        id: currentUserId,
      },
    }

    setMessagesPage((currentPage) => ({
      ...currentPage,
      content: mergeMessages(currentPage.content, [optimisticMessage]),
    }))

    forceScrollToBottom()
    setMessageDraft('')
    setAttachedAttachment(null)

    const send = async () => {
      try {
        const attachmentUrl = nextAttachedAttachment?.url ?? null

        const payload: SendMessagePayload = {
          attachmentMimeType: nextAttachedFile?.type,
          attachmentName: nextAttachedFile?.name,
          attachmentSize: nextAttachedFile?.size,
          attachmentUrl,
          content: text,
          text,
        }

        if (!nextAttachedAttachment) {
          const sentRealtime = sendRealtimeMessage({
            content: text,
            conversationId,
          })

          if (sentRealtime) {
            scheduleMessagesRefresh()
            return
          }
        }

        setIsSending(true)

        const response = await chatService.sendMessage(conversationId, payload, accessToken, {
          currentUserId,
        })

        setMessagesPage((currentPage) => ({
          ...currentPage,
          content: currentPage.content.map((message) =>
            message.id === optimisticMessageId ? response : message,
          ),
        }))

        if (conversationDetail) {
          const updatedConversation: ConversationDetail = {
            ...conversationDetail,
            lastMessageAt: response.createdAt,
            lastMessagePreview: response.body || response.attachment?.name || 'Attachment',
            readState: 'READ',
            unreadCount: 0,
            updatedAt: response.createdAt,
          }

          setConversationDetail(updatedConversation)
        }

        scheduleMessagesRefresh()
      } catch (error) {
        setMessagesPage((currentPage) => ({
          ...currentPage,
          content: currentPage.content.filter((message) => message.id !== optimisticMessageId),
        }))

        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setIsSending(false)
      }
    }

    void send()
  }

  const handleAttachFile = useCallback(
    (file: File) => {
      const uploadAttachment = async () => {
        setAttachedAttachment({
          file,
          url: '',
        })
        setIsUploadingAttachment(true)

        try {
          const uploadedUrl = await cloudinaryService.uploadFile(file, {
            folder: 'chat/attachments',
          })

          setAttachedAttachment({
            file,
            url: uploadedUrl,
          })
          showToast('Attachment uploaded.', { variant: 'success' })
        } catch (error) {
          setAttachedAttachment(null)
          showToast(getErrorMessage(error), { variant: 'error' })
        } finally {
          setIsUploadingAttachment(false)
        }
      }

      void uploadAttachment()
    },
    [showToast],
  )

  const handleMessageDraftChange = useCallback((value: string) => {
    setMessageDraft(value.slice(0, CHAT_MESSAGE_MAX_LENGTH))
  }, [])

  const handleRefreshConversation = useCallback(() => {
    const refresh = async () => {
      await Promise.all([
        loadConversation({ silent: true }),
        loadMessages({ silent: true }),
      ])
    }

    void refresh()
  }, [loadConversation, loadMessages])

  const handleToggleFavoriteConversation = useCallback(() => {
    if (!accessToken) {
      showToast('You need to sign in to update starred conversations.', { variant: 'error' })
      return
    }

    if (!conversationDetail || isDraftConversation) {
      return
    }

    const nextIsStarred = !conversationDetail.isStarred
    setConversationDetail({
      ...conversationDetail,
      isStarred: nextIsStarred,
    })

    const syncStarredState = async () => {
      try {
        await chatService.setConversationStarred(conversationDetail.id, nextIsStarred, accessToken)
      } catch (error) {
        setConversationDetail((currentDetail) => {
          if (!currentDetail || currentDetail.id !== conversationDetail.id) {
            return currentDetail
          }

          return {
            ...currentDetail,
            isStarred: !nextIsStarred,
          }
        })
        showToast(getErrorMessage(error), { variant: 'error' })
      }
    }

    void syncStarredState()
  }, [accessToken, conversationDetail, isDraftConversation, showToast])

  const handleDeleteConversation = useCallback(() => {
    showToast('Delete conversation is not available yet.', { variant: 'info' })
  }, [showToast])

  const participantName = conversationDetail?.participant?.displayName || 'Conversation'

  const isLoadingPanel = useMemo(() => {
    return isLoadingConversation || isLoadingMessages
  }, [isLoadingConversation, isLoadingMessages])

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

          <section className={styles.card} aria-label="Conversation details">
            <ChatHeader
              participantName={participantName}
              isStarred={Boolean(conversationDetail?.isStarred)}
              onBack={() => {
                navigate(APP_ROUTES.inbox)
              }}
              onRefresh={handleRefreshConversation}
              onFavorite={handleToggleFavoriteConversation}
              onDelete={handleDeleteConversation}
            />

            <MessageList
              messages={messagesPage.content}
              errorMessage={errorMessage}
              forceScrollToBottomSignal={forceScrollToBottomSignal}
              hasOlderMessages={hasOlderMessages}
              isLoading={isLoadingPanel}
              isLoadingOlder={isLoadingOlderMessages}
              onLoadOlder={handleLoadOlderMessages}
            />

            <ChatComposer
              text={messageDraft}
              attachedFile={attachedAttachment?.file ?? null}
              attachmentUploading={isUploadingAttachment}
              isSending={isSending}
              onTextChange={handleMessageDraftChange}
              onAttach={handleAttachFile}
              onClearAttachment={() => {
                setAttachedAttachment(null)
              }}
              onSend={handleSendMessage}
            />
          </section>

        </section>
      </div>
    </MainLayout>
  )
}

export default ChatConversationPage



