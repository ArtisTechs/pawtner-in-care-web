import type { SidebarIconName, SidebarItemKey, SidebarMenuItem } from '@/shared/types/layout'
import type { IconType } from 'react-icons'
import {
  FaAddressBook,
  FaCalendarAlt,
  FaCheckSquare,
  FaClipboardList,
  FaCog,
  FaDonate,
  FaInbox,
  FaPaw,
  FaSignOutAlt,
  FaTachometerAlt,
} from 'react-icons/fa'
import { NavLink } from 'react-router-dom'
import styles from './Sidebar.module.css'

interface SidebarProps {
  activeItem: SidebarItemKey
  bottomItems: SidebarMenuItem[]
  logoSrc: string
  menuItems: SidebarMenuItem[]
  onLogout?: () => void
}

interface SidebarListProps {
  activeItem: SidebarItemKey
  items: SidebarMenuItem[]
  onLogout?: () => void
}

const SIDEBAR_ICON_MAP: Record<SidebarIconName, IconType> = {
  dashboard: FaTachometerAlt,
  inbox: FaInbox,
  'pet-list': FaPaw,
  'adoption-logs': FaClipboardList,
  'donation-logs': FaDonate,
  calendar: FaCalendarAlt,
  'to-do': FaCheckSquare,
  contact: FaAddressBook,
  settings: FaCog,
  logout: FaSignOutAlt,
}

function Icon({ name }: { name: SidebarIconName }) {
  const IconComponent = SIDEBAR_ICON_MAP[name]
  return <IconComponent />
}

function SidebarList({ activeItem, items, onLogout }: SidebarListProps) {
  return (
    <ul className={styles.list}>
      {items.map((item) => {
        const isActive = item.key === activeItem
        const handleClick = item.key === 'logout' ? onLogout : undefined

        return (
          <li key={item.key}>
            {item.path ? (
              <NavLink
                to={item.path}
                className={`${styles.item} ${isActive ? styles.active : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className={styles.icon} aria-hidden="true">
                  <Icon name={item.icon} />
                </span>
                <span className={styles.label}>{item.label}</span>
              </NavLink>
            ) : (
              <button
                type="button"
                className={`${styles.item} ${isActive ? styles.active : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={handleClick}
              >
                <span className={styles.icon} aria-hidden="true">
                  <Icon name={item.icon} />
                </span>
                <span className={styles.label}>{item.label}</span>
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Sidebar({ activeItem, bottomItems, logoSrc, menuItems, onLogout }: SidebarProps) {
  return (
    <div className={styles.sidebar}>
      <div className={styles.logoWrap}>
        <img src={logoSrc} alt="Pawtner in Care" className={styles.logo} />
      </div>

      <nav className={styles.nav} aria-label="Main navigation">
        <SidebarList activeItem={activeItem} items={menuItems} onLogout={onLogout} />
      </nav>

      <div className={styles.bottomNav} aria-label="Secondary navigation">
        <SidebarList activeItem={activeItem} items={bottomItems} onLogout={onLogout} />
      </div>
    </div>
  )
}

export default Sidebar
