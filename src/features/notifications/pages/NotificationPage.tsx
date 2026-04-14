import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { FaBell, FaClock, FaCommentDots, FaEnvelope, FaPaw } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { chatRealtimeService } from '@/features/chat/services/chat-realtime.service'
import { NotificationContext } from '@/features/notifications/providers/notification-context'
import { notificationService } from '@/features/notifications/services/notification.service'
import type { NotificationItem } from '@/features/notifications/types/notification-api'
import { resolveNotificationRoute } from '@/features/notifications/utils/notification-route'
import { defaultHeaderProfile, sidebarBottomItems, sidebarLogo, sidebarMenuItems } from '@/layouts/config/navigation'
import Header from '@/layouts/Header/Header'
import MainLayout from '@/layouts/MainLayout/MainLayout'
import Sidebar from '@/layouts/Sidebar/Sidebar'
import { getErrorMessage } from '@/shared/api/api-error'
import Toast from '@/shared/components/feedback/Toast'
import { useHeaderProfile } from '@/shared/hooks/useHeaderProfile'
import { useResponsiveSidebar } from '@/shared/hooks/useResponsiveSidebar'
import { useToast } from '@/shared/hooks/useToast'
import type { SidebarItemKey } from '@/shared/types/layout'
import styles from './NotificationPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'notification'
const PAGE_SIZE = 12

type NotificationFilter = 'ALL' | 'UNREAD'

interface NotificationPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

const formatRelativeTime = (value: string) => {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) {
    return 'just now'
  }

  const diffMs = Date.now() - timestamp
  if (!Number.isFinite(diffMs)) {
    return 'just now'
  }

  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diffMs < minute) {
    return 'just now'
  }

  if (diffMs < hour) {
    const minutes = Math.max(1, Math.floor(diffMs / minute))
    return `${minutes}m ago`
  }

  if (diffMs < day) {
    const hours = Math.max(1, Math.floor(diffMs / hour))
    return `${hours}h ago`
  }

  const days = Math.max(1, Math.floor(diffMs / day))
  return `${days}d ago`
}

const NotificationTypeIcon = ({ notification }: { notification: NotificationItem }) => {
  if (notification.type === 'CHAT') {
    return <FaCommentDots aria-hidden="true" />
  }

  if (notification.type === 'ADOPTION') {
    return <FaPaw aria-hidden="true" />
  }

  return <FaBell aria-hidden="true" />
}

function NotificationPage({ onLogout, session }: NotificationPageProps) {
  const navigate = useNavigate()
  const { clearToast, showToast, toast } = useToast()
  const [searchValue, setSearchValue] = useState('')
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('ALL')
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [allTotalCount, setAllTotalCount] = useState(0)
  const { unreadCount, refreshUnreadCount } = useContext(NotificationContext)
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const listWrapRef = useRef<HTMLDivElement | null>(null)
  const infiniteSentinelRef = useRef<HTMLDivElement | null>(null)
  const resolvedHeaderProfile = useHeaderProfile({
    fallbackProfile: defaultHeaderProfile,
    session,
  })
  const accessToken = session?.accessToken?.trim() ?? ''

  const loadNotifications = useCallback(
    async (
      pageToLoad: number,
      options?: {
        replace?: boolean
        silent?: boolean
      },
    ) => {
      if (!accessToken) {
        setNotifications([])
        setCurrentPage(0)
        setTotalElements(0)
        setTotalPages(1)
        if (activeFilter === 'ALL') {
          setAllTotalCount(0)
        }
        return
      }

      const isSilent = Boolean(options?.silent)
      const shouldReplace = Boolean(options?.replace)
      const isInitialPage = pageToLoad === 0

      if (!isSilent && isInitialPage) {
        setIsLoading(true)
        if (shouldReplace) {
          setNotifications([])
        }
      }

      if (!isInitialPage) {
        setIsLoadingMore(true)
      }

      try {
        const response = await notificationService.listMyNotifications(accessToken, {
          isRead: activeFilter === 'UNREAD' ? false : undefined,
          page: pageToLoad,
          size: PAGE_SIZE,
          sortBy: 'createdAt',
          sortDir: 'desc',
        })

        setNotifications((previousNotifications) => {
          if (shouldReplace || isInitialPage) {
            return response.content
          }

          if (previousNotifications.length === 0) {
            return response.content
          }

          const seenIds = new Set(previousNotifications.map((entry) => entry.id))
          const nextEntries = response.content.filter((entry) => !seenIds.has(entry.id))
          return nextEntries.length > 0 ? [...previousNotifications, ...nextEntries] : previousNotifications
        })
        setCurrentPage(response.page)
        setTotalElements(response.totalElements)
        setTotalPages(response.totalPages)

        if (activeFilter === 'ALL') {
          setAllTotalCount(response.totalElements)
        }
      } catch (error) {
        if (!isSilent) {
          showToast(getErrorMessage(error), { variant: 'error' })
        }
      } finally {
        if (!isSilent && isInitialPage) {
          setIsLoading(false)
        }

        if (!isInitialPage) {
          setIsLoadingMore(false)
        }
      }
    },
    [accessToken, activeFilter, showToast],
  )

  useEffect(() => {
    clearToast()
    void loadNotifications(0, { replace: true })
  }, [clearToast, loadNotifications])

  useEffect(() => {
    if (!accessToken) {
      return
    }

    const unsubscribe = chatRealtimeService.subscribeNotification(() => {
      void loadNotifications(0, { replace: true, silent: true })
    })

    return unsubscribe
  }, [accessToken, loadNotifications])

  const hasMorePages = currentPage + 1 < totalPages

  useEffect(() => {
    if (!accessToken || isLoading || isLoadingMore || !hasMorePages) {
      return
    }

    const sentinel = infiniteSentinelRef.current
    const listWrap = listWrapRef.current
    if (!sentinel || !listWrap) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (!entry?.isIntersecting) {
          return
        }

        void loadNotifications(currentPage + 1, { silent: true })
      },
      {
        root: listWrap,
        rootMargin: '140px 0px 140px 0px',
        threshold: 0,
      },
    )

    observer.observe(sentinel)

    return () => {
      observer.disconnect()
    }
  }, [accessToken, currentPage, hasMorePages, isLoading, isLoadingMore, loadNotifications])

  const visibleNotifications = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()
    if (!normalizedSearch) {
      return notifications
    }

    return notifications.filter((notification) => {
      const title = notification.title.toLowerCase()
      const message = notification.message.toLowerCase()
      return title.includes(normalizedSearch) || message.includes(normalizedSearch)
    })
  }, [notifications, searchValue])

  const showingFrom = totalElements === 0 ? 0 : 1
  const showingTo = totalElements === 0 ? 0 : Math.min(notifications.length, totalElements)

  const handleNotificationClick = async (notification: NotificationItem) => {
    const targetRoute = resolveNotificationRoute(notification)
    navigate(targetRoute)

    if (notification.isRead || !accessToken) {
      return
    }

    void notificationService
      .markAsRead(notification.id, accessToken)
      .then(async () => {
        await Promise.all([loadNotifications(0, { replace: true, silent: true }), refreshUnreadCount()])
      })
      .catch(() => {
        // Keep navigation flow uninterrupted even when read-sync fails.
      })
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
          <h1 className={styles.pageTitle}>Notification</h1>

          <div className={styles.panel}>
            <div className={styles.toolbar}>
              <button
                type="button"
                className={`${styles.filterTab} ${activeFilter === 'ALL' ? styles.filterTabActive : ''}`}
                onClick={() => {
                  setActiveFilter('ALL')
                }}
              >
                <FaBell aria-hidden="true" />
                <span>Updates</span>
                <span className={styles.filterCount}>{allTotalCount}</span>
              </button>

              <button
                type="button"
                className={`${styles.filterTab} ${activeFilter === 'UNREAD' ? styles.filterTabActive : ''}`}
                onClick={() => {
                  setActiveFilter('UNREAD')
                }}
              >
                <FaEnvelope aria-hidden="true" />
                <span>Unread</span>
                <span className={styles.filterCount}>{unreadCount}</span>
              </button>
            </div>

            <div ref={listWrapRef} className={styles.listWrap}>
              {isLoading ? (
                Array.from({ length: 7 }, (_, index) => (
                  <div key={`notification-skeleton-${index}`} className={styles.itemSkeleton} aria-hidden="true" />
                ))
              ) : visibleNotifications.length === 0 ? (
                <div className={styles.emptyState}>No notifications found.</div>
              ) : (
                visibleNotifications.map((notification) => (
                  <article
                    key={notification.id}
                    className={`${styles.itemCard} ${notification.isRead ? styles.itemRead : styles.itemUnread}`}
                    onClick={() => {
                      void handleNotificationClick(notification)
                    }}
                  >
                    <span className={styles.itemIcon} aria-hidden="true">
                      <NotificationTypeIcon notification={notification} />
                    </span>

                    <div className={styles.itemBody}>
                      <p className={styles.itemMessage}>{notification.message || notification.title}</p>
                    </div>

                    <div className={styles.itemMeta}>
                      <span className={styles.itemTime}>
                        <FaClock aria-hidden="true" />
                        <span>{formatRelativeTime(notification.createdAt)}</span>
                      </span>
                    </div>
                  </article>
                ))
              )}

              {isLoadingMore ? <div className={styles.loadMoreSkeleton} aria-hidden="true" /> : null}
              <div ref={infiniteSentinelRef} className={styles.infiniteSentinel} aria-hidden="true" />
            </div>
          </div>

          <footer className={styles.footer}>
            <p className={styles.paginationText}>
              Showing {showingFrom}-{showingTo} of {totalElements.toLocaleString()}
            </p>
            <p className={styles.scrollHint}>{hasMorePages ? 'Scroll to load more' : 'You have reached the end'}</p>
          </footer>
        </section>
      </div>
    </MainLayout>
  )
}

export default NotificationPage
