import titleLogo from '../../assets/title-logo.png'
import type {
  DonationChartPoint,
  HeaderProfile,
  ReportChartPoint,
  SidebarMenuItem,
  StatCardData,
} from '../../types/dashboard'

export const sidebarLogo = titleLogo

export const headerProfile: HeaderProfile = {
  name: 'Lea Ibunan',
  role: 'Admin',
}

export const sidebarMenuItems: SidebarMenuItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'inbox', label: 'Inbox', icon: 'inbox' },
  { key: 'pet-list', label: 'Pet List', icon: 'pet-list' },
  { key: 'adoption-logs', label: 'Adoption Logs', icon: 'adoption-logs' },
  { key: 'donation-logs', label: 'Donation Logs', icon: 'donation-logs' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar' },
  { key: 'to-do', label: 'To-Do', icon: 'to-do' },
  { key: 'contact', label: 'Contact', icon: 'contact' },
]

export const sidebarBottomItems: SidebarMenuItem[] = [
  { key: 'settings', label: 'Settings', icon: 'settings' },
  { key: 'logout', label: 'Logout', icon: 'logout' },
]

export const statCards: StatCardData[] = [
  {
    id: 'total-dogs',
    title: 'Total Dogs',
    value: '152',
    icon: 'dogs',
  },
  {
    id: 'total-cats',
    title: 'Total Cats',
    value: '236',
    icon: 'cats',
  },
  {
    id: 'total-donation',
    title: 'Total Donation',
    value: '6,246',
    icon: 'donation',
  },
  {
    id: 'total-reports',
    title: 'Total Reports',
    value: '475',
    icon: 'reports',
  },
]

export const reportDetailsData: ReportChartPoint[] = [
  { label: '12', value: 20 },
  { label: '16', value: 28 },
  { label: '20', value: 30 },
  { label: '24', value: 49 },
  { label: '28', value: 40 },
  { label: '30', value: 53 },
  { label: '34', value: 31 },
  { label: '38', value: 46 },
  { label: '42', value: 44 },
  { label: '48', value: 54 },
  { label: '52', value: 87 },
  { label: '56', value: 39 },
  { label: '60', value: 54 },
  { label: '64', value: 49 },
  { label: '68', value: 44 },
  { label: '72', value: 56 },
  { label: '76', value: 45 },
  { label: '80', value: 50 },
  { label: '84', value: 62 },
  { label: '88', value: 25 },
  { label: '92', value: 31 },
  { label: '96', value: 27 },
  { label: '100', value: 49 },
  { label: '104', value: 47 },
  { label: '108', value: 45 },
  { label: '112', value: 74 },
  { label: '116', value: 60 },
  { label: '120', value: 68 },
  { label: '124', value: 61 },
  { label: '128', value: 54 },
  { label: '132', value: 53 },
  { label: '136', value: 53 },
  { label: '140', value: 59 },
  { label: '144', value: 43 },
  { label: '148', value: 58 },
  { label: '152', value: 52 },
  { label: '156', value: 58 },
  { label: '160', value: 53 },
  { label: '164', value: 49 },
  { label: '168', value: 56 },
]

export const donationData: DonationChartPoint[] = [
  { label: 'Jan', dogs: 24, cats: 44 },
  { label: 'Feb', dogs: 35, cats: 70 },
  { label: 'Mar', dogs: 68, cats: 42 },
  { label: 'Apr', dogs: 47, cats: 20 },
  { label: 'May', dogs: 25, cats: 32 },
  { label: 'Jun', dogs: 56, cats: 48 },
  { label: 'Jul', dogs: 90, cats: 35 },
  { label: 'Aug', dogs: 42, cats: 28 },
  { label: 'Sep', dogs: 66, cats: 20 },
  { label: 'Oct', dogs: 38, cats: 44 },
  { label: 'Nov', dogs: 33, cats: 90 },
  { label: 'Dec', dogs: 57, cats: 40 },
]
