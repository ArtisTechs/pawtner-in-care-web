import type {
  ChartRange,
  DonationChartPoint,
  ReportChartPoint,
  StatCardData,
} from '@/features/dashboard/types/dashboard'

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

export const reportDetailsDataByRange: Record<ChartRange, ReportChartPoint[]> = {
  day: [
    { label: '12 AM', value: 18 },
    { label: '3 AM', value: 24 },
    { label: '6 AM', value: 31 },
    { label: '9 AM', value: 57 },
    { label: '12 PM', value: 72 },
    { label: '3 PM', value: 64 },
    { label: '6 PM', value: 52 },
    { label: '9 PM', value: 40 },
  ],
  week: [
    { label: 'Mon', value: 35 },
    { label: 'Tue', value: 41 },
    { label: 'Wed', value: 58 },
    { label: 'Thu', value: 46 },
    { label: 'Fri', value: 63 },
    { label: 'Sat', value: 71 },
    { label: 'Sun', value: 49 },
  ],
  month: [
    { label: 'Week 1', value: 44 },
    { label: 'Week 2', value: 57 },
    { label: 'Week 3', value: 69 },
    { label: 'Week 4', value: 53 },
    { label: 'Week 5', value: 61 },
  ],
  year: [
    { label: 'Jan', value: 41 },
    { label: 'Feb', value: 48 },
    { label: 'Mar', value: 56 },
    { label: 'Apr', value: 52 },
    { label: 'May', value: 61 },
    { label: 'Jun', value: 67 },
    { label: 'Jul', value: 72 },
    { label: 'Aug', value: 63 },
    { label: 'Sep', value: 58 },
    { label: 'Oct', value: 69 },
    { label: 'Nov', value: 74 },
    { label: 'Dec', value: 66 },
  ],
}

export const donationDataByRange: Record<ChartRange, DonationChartPoint[]> = {
  day: [
    { label: '12 AM', paymentMethod: 'Gcash', value: 41 },
    { label: '3 AM', paymentMethod: 'Gcash', value: 50 },
    { label: '6 AM', paymentMethod: 'Gcash', value: 64 },
    { label: '9 AM', paymentMethod: 'Gcash', value: 85 },
    { label: '12 PM', paymentMethod: 'Gcash', value: 110 },
    { label: '3 PM', paymentMethod: 'Gcash', value: 104 },
    { label: '6 PM', paymentMethod: 'Gcash', value: 87 },
    { label: '9 PM', paymentMethod: 'Gcash', value: 69 },
  ],
  week: [
    { label: 'Mon', paymentMethod: 'Gcash', value: 68 },
    { label: 'Tue', paymentMethod: 'Gcash', value: 105 },
    { label: 'Wed', paymentMethod: 'Gcash', value: 110 },
    { label: 'Thu', paymentMethod: 'Gcash', value: 67 },
    { label: 'Fri', paymentMethod: 'Gcash', value: 57 },
    { label: 'Sat', paymentMethod: 'Gcash', value: 104 },
    { label: 'Sun', paymentMethod: 'Gcash', value: 125 },
  ],
  month: [
    { label: 'Week 1', paymentMethod: 'Gcash', value: 70 },
    { label: 'Week 2', paymentMethod: 'Gcash', value: 86 },
    { label: 'Week 3', paymentMethod: 'Gcash', value: 82 },
    { label: 'Week 4', paymentMethod: 'Gcash', value: 123 },
    { label: 'Week 5', paymentMethod: 'Gcash', value: 97 },
  ],
  year: [
    { label: 'Jan', paymentMethod: 'Gcash', value: 68 },
    { label: 'Feb', paymentMethod: 'Gcash', value: 105 },
    { label: 'Mar', paymentMethod: 'Gcash', value: 110 },
    { label: 'Apr', paymentMethod: 'Gcash', value: 67 },
    { label: 'May', paymentMethod: 'Gcash', value: 57 },
    { label: 'Jun', paymentMethod: 'Gcash', value: 104 },
    { label: 'Jul', paymentMethod: 'Gcash', value: 125 },
    { label: 'Aug', paymentMethod: 'Gcash', value: 70 },
    { label: 'Sep', paymentMethod: 'Gcash', value: 86 },
    { label: 'Oct', paymentMethod: 'Gcash', value: 82 },
    { label: 'Nov', paymentMethod: 'Gcash', value: 123 },
    { label: 'Dec', paymentMethod: 'Gcash', value: 97 },
  ],
}
