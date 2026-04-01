import {
  Area,
  AreaChart,
  CartesianGrid,
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
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 14, right: 14, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id="donationDogsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59f82" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#f59f82" stopOpacity={0.06} />
          </linearGradient>
          <linearGradient id="donationCatsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c6a2f3" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#c6a2f3" stopOpacity={0.07} />
          </linearGradient>
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
          domain={[0, 100]}
          ticks={[0, 20, 40, 60, 80, 100]}
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
        />

        <Area
          type="monotone"
          dataKey="dogs"
          stroke="#f2997a"
          strokeWidth={2}
          fill="url(#donationDogsFill)"
          activeDot={{ r: 5 }}
        />
        <Area
          type="monotone"
          dataKey="cats"
          stroke="#ba90ef"
          strokeWidth={2}
          fill="url(#donationCatsFill)"
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default DonationChart
