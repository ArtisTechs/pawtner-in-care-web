import { useContext, useState, type ChangeEvent } from 'react'
import { FaBars, FaBell, FaSearch, FaUserCircle } from 'react-icons/fa'
import { useLocation, useNavigate } from 'react-router-dom'
import { APP_ROUTES } from '@/app/routes/route-paths'
import { NotificationContext } from '@/features/notifications/providers/notification-context'
import type { HeaderProfile } from '@/shared/types/layout'
import styles from './Header.module.css'

interface HeaderProps {
  profile: HeaderProfile
  searchValue: string
  onSearchChange: (value: string) => void
  isMenuOpen: boolean
  onMenuToggle: () => void
}

function Header({ profile, searchValue, onSearchChange, isMenuOpen, onMenuToggle }: HeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { unreadCount } = useContext(NotificationContext)
  const avatarSrc = profile.avatarSrc?.trim() ?? ''
  const [failedAvatarSrc, setFailedAvatarSrc] = useState<string | null>(null)
  const isNotificationPage =
    location.pathname === APP_ROUTES.notifications ||
    location.pathname.startsWith(`${APP_ROUTES.notifications}/`)
  const isProfileSettingsPage = location.pathname === APP_ROUTES.profileSettings

  const shouldShowAvatarImage = avatarSrc.length > 0 && failedAvatarSrc !== avatarSrc

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    onSearchChange(event.target.value)
  }

  return (
    <div className={styles.header}>
      <div className={styles.leftSection}>
        <button
          type="button"
          className={styles.menuButton}
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMenuOpen}
          onClick={onMenuToggle}
        >
          <FaBars aria-hidden="true" className={styles.menuIcon} />
        </button>

        <div className={styles.searchField} role="search">
          <FaSearch aria-hidden="true" className={styles.searchIcon} />
          <input
            type="search"
            value={searchValue}
            onChange={handleSearchChange}
            placeholder="Search"
            aria-label="Search dashboard"
            className={styles.searchInput}
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.iconButton} ${isNotificationPage ? styles.iconButtonActive : ''}`}
          aria-label={
            unreadCount > 0 ? `Notifications, ${unreadCount} unread notifications` : 'Notifications'
          }
          aria-current={isNotificationPage ? 'page' : undefined}
          onClick={() => {
            navigate(APP_ROUTES.notifications)
          }}
        >
          <span className={styles.notificationIconWrap}>
            <FaBell aria-hidden="true" className={styles.notificationIcon} />
            {unreadCount > 0 ? (
              <span className={styles.notificationBadge} aria-hidden="true">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </span>
        </button>

        <button
          type="button"
          className={`${styles.profileButton} ${isProfileSettingsPage ? styles.profileButtonActive : ''}`}
          aria-label="Open profile settings"
          aria-current={isProfileSettingsPage ? 'page' : undefined}
          onClick={() => {
            navigate(APP_ROUTES.profileSettings)
          }}
        >
          {shouldShowAvatarImage ? (
            <img
              src={avatarSrc}
              alt={`${profile.name} avatar`}
              className={styles.avatar}
              onError={() => {
                setFailedAvatarSrc(avatarSrc)
              }}
            />
          ) : (
            <span className={styles.avatarFallback} aria-hidden="true">
              <FaUserCircle className={styles.avatarIcon} />
            </span>
          )}
          <span className={styles.profileText}>
            <span className={styles.name}>{profile.name}</span>
            <span className={styles.role}>{profile.role}</span>
          </span>
        </button>
      </div>
    </div>
  )
}

export default Header
