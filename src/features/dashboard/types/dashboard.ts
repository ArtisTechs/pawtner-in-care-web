export type StatIconName = 'dogs' | 'cats' | 'donation' | 'reports'

export interface StatCardData {
  id: string
  title: string
  value: string
  icon: StatIconName
}

export type ChartRange = 'day' | 'week' | 'month'

export interface ChartFilterOption {
  value: ChartRange
  label: string
}

export interface ReportChartPoint {
  label: string
  value: number
}

export interface DonationChartPoint {
  label: string
  dogs: number
  cats: number
}
