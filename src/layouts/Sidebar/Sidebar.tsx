import { useContext, useLayoutEffect, useRef, useState } from 'react'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { resolveDashboardAccessRole } from '@/features/auth/utils/auth-utils'
import { ChatRealtimeContext } from '@/features/chat/providers/chat-realtime-context'
import { NotificationContext } from '@/features/notifications/providers/notification-context'
import { resolveSidebarBottomItemsByRole, resolveSidebarMenuItemsByRole } from '@/layouts/config/navigation'
import type { SidebarIconName, SidebarItemKey, SidebarMenuItem } from '@/shared/types/layout'
import ConfirmModal from '@/shared/components/ui/ConfirmModal/ConfirmModal'
import type { IconType } from 'react-icons'
import {
  FaAward,
  FaBell,
  FaBoxOpen,
  FaCalendarAlt,
  FaCheckSquare,
  FaClipboardList,
  FaClinicMedical,
  FaCog,
  FaComments,
  FaCreditCard,
  FaDonate,
  FaGift,
  FaInbox,
  FaPaw,
  FaSearch,
  FaSignOutAlt,
  FaTachometerAlt,
  FaTrophy,
  FaUsers,
} from 'react-icons/fa'
import { NavLink } from 'react-router-dom'
import styles from './Sidebar.module.css'

interface SidebarProps {
  session?: AuthSession | null
  activeItem: SidebarItemKey
  bottomItems: SidebarMenuItem[]
  logoSrc: string
  menuItems: SidebarMenuItem[]
  onLogout?: () => void
}

interface SidebarListProps {
  activeItem: SidebarItemKey
  inboxUnreadCount?: number
  notificationUnreadCount?: number
  items: SidebarMenuItem[]
  onLogout?: () => void
  onNavigate?: () => void
}

interface SidebarSection {
  items: SidebarMenuItem[]
  title: string
}

const SIDEBAR_SECTION_CONFIG: Array<{ keys: SidebarItemKey[]; title: string }> = [
  {
    title: 'Home',
    keys: ['dashboard', 'inbox'],
  },
  {
    title: 'Pets',
    keys: ['pet-list', 'adoption-logs', 'emergency-sos'],
  },
  {
    title: 'Veterinary',
    keys: ['veterinary-clinic-list'],
  },
  {
    title: 'Donations',
    keys: [
      'donation-campaign-list',
      'donation-logs',
      'payment-mode-list',
      'item-listing',
      'gift-logs',
    ],
  },
  {
    title: 'Achievements',
    keys: [
      'achievement-list',
      'achievement-assignment',
      'heroes-wall',
    ],
  },
  {
    title: 'Community',
    keys: ['events-list', 'volunteer-list', 'community-listing'],
  },
  {
    title: 'Planning',
    keys: ['calendar', 'to-do'],
  },
  {
    title: 'Admin',
    keys: ['user-list', 'shelter-list', 'shelter-association'],
  },
]

const SIDEBAR_SCROLL_STORAGE_KEY = 'pawtner-sidebar-scroll-top'
const AUTH_SESSION_STORAGE_KEY = '@pawtner/auth/session'

const resolveStoredSessionRole = () => {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    const rawSession = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)
    if (!rawSession) {
      return ''
    }

    const parsedSession = JSON.parse(rawSession) as AuthSession
    return resolveDashboardAccessRole(parsedSession)
  } catch {
    return ''
  }
}

const SIDEBAR_ICON_MAP: Record<SidebarIconName, IconType> = {
  dashboard: FaTachometerAlt,
  inbox: FaInbox,
  notification: FaBell,
  'pet-list': FaPaw,
  'veterinary-clinic-list': FaClinicMedical,
  'user-list': FaUsers,
  'shelter-list': FaClinicMedical,
  'shelter-association': FaUsers,
  'adoption-logs': FaClipboardList,
  'emergency-sos': FaClipboardList,
  'donation-campaign-list': FaDonate,
  'donation-logs': FaDonate,
  'gift-logs': FaGift,
  'achievement-list': FaAward,
  'heroes-wall': FaTrophy,
  'item-listing': FaBoxOpen,
  'events-list': FaCalendarAlt,
  'volunteer-list': FaUsers,
  'payment-mode-list': FaCreditCard,
  'community-listing': FaComments,
  calendar: FaCalendarAlt,
  'to-do': FaCheckSquare,
  settings: FaCog,
  logout: FaSignOutAlt,
}

function Icon({ name }: { name: SidebarIconName }) {
  const IconComponent = SIDEBAR_ICON_MAP[name]
  return <IconComponent />
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase()
}

function groupSidebarItemsByCategory(items: SidebarMenuItem[], searchQuery: string): SidebarSection[] {
  const itemByKey = new Map(items.map((item) => [item.key, item]))
  const usedKeys = new Set<SidebarItemKey>()
  const normalizedSearchQuery = normalizeSearchValue(searchQuery)

  const categorizedSections = SIDEBAR_SECTION_CONFIG.map(({ keys, title }) => {
    const categoryItems = keys
      .flatMap((key) => {
        const item = itemByKey.get(key)
        if (!item) {
          return []
        }

        usedKeys.add(key)
        return [item]
      })
      .filter((item) => {
        if (!normalizedSearchQuery) {
          return true
        }

        const searchableText = `${item.label} ${item.key.replaceAll('-', ' ')} ${title}`.toLowerCase()
        return searchableText.includes(normalizedSearchQuery)
      })

    return {
      title,
      items: categoryItems,
    }
  }).filter((section) => section.items.length > 0)

  const uncategorizedItems = items.filter((item) => !usedKeys.has(item.key))
  if (uncategorizedItems.length > 0) {
    const filteredUncategorizedItems = uncategorizedItems.filter((item) => {
      if (!normalizedSearchQuery) {
        return true
      }

      const searchableText = `${item.label} ${item.key.replaceAll('-', ' ')} other tools`.toLowerCase()
      return searchableText.includes(normalizedSearchQuery)
    })

    if (filteredUncategorizedItems.length === 0) {
      return categorizedSections
    }

    categorizedSections.push({
      title: 'Other Tools',
      items: filteredUncategorizedItems,
    })
  }

  return categorizedSections
}

function SidebarList({
  activeItem,
  inboxUnreadCount = 0,
  notificationUnreadCount = 0,
  items,
  onLogout,
  onNavigate,
}: SidebarListProps) {
  return (
    <ul className={styles.list}>
      {items.map((item) => {
        const isActive = item.key === activeItem
        const handleClick = item.key === 'logout' ? onLogout : undefined
        const showInboxUnreadIndicator = item.key === 'inbox' && inboxUnreadCount > 0
        const showNotificationUnreadIndicator = item.key === 'notification' && notificationUnreadCount > 0
        const unreadLabel = inboxUnreadCount > 99 ? '99+' : String(inboxUnreadCount)
        const notificationUnreadLabel =
          notificationUnreadCount > 99 ? '99+' : String(notificationUnreadCount)
        const itemAriaLabel = showInboxUnreadIndicator
          ? `${item.label}, ${inboxUnreadCount} unread messages`
          : showNotificationUnreadIndicator
            ? `${item.label}, ${notificationUnreadCount} unread notifications`
          : item.label

        return (
          <li key={item.key}>
            {item.path ? (
              <NavLink
                to={item.path}
                preventScrollReset
                onClick={onNavigate}
                className={`${styles.item} ${isActive ? styles.active : ''}`}
                aria-label={itemAriaLabel}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className={styles.icon} aria-hidden="true">
                  <Icon name={item.icon} />
                </span>
                <span className={styles.label}>{item.label}</span>
                {showInboxUnreadIndicator ? (
                  <span className={styles.unreadIndicator} aria-hidden="true">
                    {unreadLabel}
                  </span>
                ) : showNotificationUnreadIndicator ? (
                  <span className={styles.unreadIndicator} aria-hidden="true">
                    {notificationUnreadLabel}
                  </span>
                ) : null}
              </NavLink>
            ) : (
              <button
                type="button"
                className={`${styles.item} ${isActive ? styles.active : ''}`}
                aria-label={itemAriaLabel}
                aria-current={isActive ? 'page' : undefined}
                onClick={handleClick}
              >
                <span className={styles.icon} aria-hidden="true">
                  <Icon name={item.icon} />
                </span>
                <span className={styles.label}>{item.label}</span>
                {showInboxUnreadIndicator ? (
                  <span className={styles.unreadIndicator} aria-hidden="true">
                    {unreadLabel}
                  </span>
                ) : showNotificationUnreadIndicator ? (
                  <span className={styles.unreadIndicator} aria-hidden="true">
                    {notificationUnreadLabel}
                  </span>
                ) : null}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function SidebarSections({
  activeItem,
  inboxUnreadCount,
  notificationUnreadCount,
  items,
  searchQuery,
  onLogout,
  onNavigate,
}: SidebarListProps & { searchQuery: string }) {
  const sections = groupSidebarItemsByCategory(items, searchQuery)

  if (sections.length === 0) {
    return <p className={styles.emptyState}>No menu items match your search.</p>
  }

  return (
    <div className={styles.sectionList}>
      {sections.map((section) => (
        <section key={section.title} className={styles.section} aria-label={section.title}>
          <p className={styles.sectionTitle}>{section.title}</p>
          <SidebarList
            activeItem={activeItem}
            inboxUnreadCount={inboxUnreadCount}
            notificationUnreadCount={notificationUnreadCount}
            items={section.items}
            onLogout={onLogout}
            onNavigate={onNavigate}
          />
        </section>
      ))}
    </div>
  )
}

function Sidebar({ activeItem, bottomItems, logoSrc, menuItems, onLogout, session }: SidebarProps) {
  const { totalUnreadCount } = useContext(ChatRealtimeContext)
  const { unreadCount: notificationUnreadCount } = useContext(NotificationContext)
  const [isLogoutConfirmationOpen, setIsLogoutConfirmationOpen] = useState(false)
  const [menuSearchValue, setMenuSearchValue] = useState('')
  const navRef = useRef<HTMLElement | null>(null)
  const resolvedRole = resolveDashboardAccessRole(session)
  const sessionRole = resolvedRole || resolveStoredSessionRole()
  const roleBasedMenuItems = resolveSidebarMenuItemsByRole(sessionRole, menuItems)
  const roleBasedBottomItems = resolveSidebarBottomItemsByRole(sessionRole, bottomItems)

  const persistNavScrollTop = () => {
    const navElement = navRef.current
    if (!navElement) {
      return
    }

    try {
      window.sessionStorage.setItem(SIDEBAR_SCROLL_STORAGE_KEY, String(navElement.scrollTop))
    } catch {
      // Ignore storage errors and continue with default scroll behavior.
    }
  }

  useLayoutEffect(() => {
    const navElement = navRef.current
    if (!navElement) {
      return
    }

    try {
      const storedValue = window.sessionStorage.getItem(SIDEBAR_SCROLL_STORAGE_KEY)
      if (storedValue) {
        const parsedValue = Number(storedValue)
        if (Number.isFinite(parsedValue)) {
          navElement.scrollTop = parsedValue
        }
      }
    } catch {
      // Ignore storage errors and continue with default scroll behavior.
    }

    navElement.addEventListener('scroll', persistNavScrollTop, { passive: true })

    return () => {
      persistNavScrollTop()
      navElement.removeEventListener('scroll', persistNavScrollTop)
    }
  }, [])

  const handleLogoutRequest = () => {
    if (!onLogout) {
      return
    }

    setIsLogoutConfirmationOpen(true)
  }

  const handleLogoutConfirm = () => {
    setIsLogoutConfirmationOpen(false)
    onLogout?.()
  }

  return (
    <>
      <div className={styles.sidebar}>
        <div className={styles.logoWrap}>
          <img src={logoSrc} alt="Pawtner in Care" className={styles.logo} />
        </div>

        <nav ref={navRef} className={styles.nav} aria-label="Main navigation">
          <div className={styles.menuSearchSticky}>
            <label className={styles.menuSearchField} aria-label="Search menu items">
              <FaSearch aria-hidden="true" className={styles.menuSearchIcon} />
              <input
                type="search"
                value={menuSearchValue}
                onChange={(event) => {
                  setMenuSearchValue(event.target.value)
                }}
                placeholder="Search menu"
                className={styles.menuSearchInput}
              />
            </label>
          </div>

          <SidebarSections
            activeItem={activeItem}
            inboxUnreadCount={totalUnreadCount}
            notificationUnreadCount={notificationUnreadCount}
            items={roleBasedMenuItems}
            searchQuery={menuSearchValue}
            onLogout={handleLogoutRequest}
            onNavigate={persistNavScrollTop}
          />
        </nav>

        <div className={styles.bottomNav} aria-label="Secondary navigation">
          <SidebarList activeItem={activeItem} items={roleBasedBottomItems} onLogout={handleLogoutRequest} />
        </div>
      </div>

      <ConfirmModal
        isOpen={isLogoutConfirmationOpen}
        title="Sign out?"
        message="Are you sure you want to sign out of your account?"
        confirmLabel="Sign Out"
        cancelLabel="Cancel"
        ariaLabel="Sign out confirmation"
        onCancel={() => {
          setIsLogoutConfirmationOpen(false)
        }}
        onConfirm={handleLogoutConfirm}
      />
    </>
  )
}

export default Sidebar

