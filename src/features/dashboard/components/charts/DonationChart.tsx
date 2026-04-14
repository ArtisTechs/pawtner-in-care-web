import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DonationChartPoint } from '@/features/dashboard/types/dashboard'

interface DonationChartProps {
  data: DonationChartPoint[]
}

function DonationChart({ data }: DonationChartProps) {
  if (!data.length) {
    return null
  }

  const groupedByLabel = new Map<string, Record<string, number | string>>()
  const paymentMethods = new Set<string>()

  for (const point of data) {
    const method = point.paymentMethod?.trim() || 'Unknown'
    paymentMethods.add(method)

    const row = groupedByLabel.get(point.label) ?? { label: point.label }
    row[method] = point.value
    groupedByLabel.set(point.label, row)
  }

  const methods = Array.from(paymentMethods)
  const chartData = Array.from(groupedByLabel.values()).map((row) => {
    const normalizedRow: Record<string, number | string> = { label: String(row.label) }

    for (const method of methods) {
      const value = row[method]
      normalizedRow[method] = typeof value === 'number' ? value : 0
    }

    return normalizedRow
  })

  const currencyFormatter = new Intl.NumberFormat('en-PH', {
    currency: 'PHP',
    style: 'currency',
  })

  const methodPalette = ['#f2997a', '#ba90ef', '#4b86ea', '#67b87a', '#f2b547']
  const gradientIdByMethod = new Map(
    methods.map((method) => [method, `donationFill-${method.replace(/[^a-zA-Z0-9_-]/g, '-')}`]),
  )

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
      <AreaChart data={chartData} margin={{ top: 14, right: 14, left: 0, bottom: 4 }}>
        <defs>
          {methods.map((method, index) => {
            const color = methodPalette[index % methodPalette.length]
            const gradientId = gradientIdByMethod.get(method) ?? 'donationFill-fallback'

            return (
              <linearGradient key={method} id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.85} />
                <stop offset="100%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            )
          })}
        </defs>

        <CartesianGrid stroke="#edf2fb" vertical={false} />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#9ca6b4', fontSize: 11 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          domain={[0, 'dataMax + 10']}
          tick={{ fill: '#9ca6b4', fontSize: 11 }}
          width={34}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: '1px solid #e2e9f5',
            boxShadow: '0 8px 20px rgba(35, 86, 162, 0.12)',
            fontSize: 12,
          }}
          formatter={(value, name) => {
            const donationValue = typeof value === 'number' ? value : Number(value) || 0
            return [currencyFormatter.format(donationValue), String(name)]
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />

        {methods.map((method, index) => {
          const color = methodPalette[index % methodPalette.length]
          const gradientId = gradientIdByMethod.get(method) ?? 'donationFill-fallback'
          return (
            <Area
              key={method}
              type="monotone"
              dataKey={method}
              name={method}
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              activeDot={{ r: 5 }}
            />
          )
        })}
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default DonationChart
