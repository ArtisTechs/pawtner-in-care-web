import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ReportChartPoint } from '@/features/dashboard/types/dashboard'

interface ReportDetailsChartProps {
  data: ReportChartPoint[]
}

function ReportDetailsChart({ data }: ReportDetailsChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 18, right: 14, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id="reportFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4D89F7" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#4D89F7" stopOpacity={0.04} />
          </linearGradient>
        </defs>

        <CartesianGrid stroke="#edf2fb" vertical={false} />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#9ca6b4', fontSize: 11 }}
          interval="preserveStartEnd"
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          domain={[0, 100]}
          ticks={[0, 20, 40, 60, 80, 100]}
          tickFormatter={(value) => `${value}%`}
          tick={{ fill: '#9ca6b4', fontSize: 11 }}
          width={38}
        />
        <Tooltip
          cursor={{ stroke: '#8fb5f6', strokeDasharray: '4 4' }}
          contentStyle={{
            borderRadius: 8,
            border: '1px solid #e2e9f5',
            boxShadow: '0 8px 20px rgba(35, 86, 162, 0.12)',
            fontSize: 12,
          }}
          formatter={(value) => [`${value}%`, 'Report Rate']}
        />

        <Area
          type="monotone"
          dataKey="value"
          stroke="#447CEF"
          strokeWidth={2}
          fill="url(#reportFill)"
          activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2 }}
          dot={(dotProps) => {
            const { cx, cy, index } = dotProps
            const isHighlight = index === 10

            if (!isHighlight || typeof cx !== 'number' || typeof cy !== 'number') {
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={2}
                  fill="#4d89f7"
                  stroke="#4d89f7"
                  strokeWidth={1}
                />
              )
            }

            return (
              <g>
                <rect
                  x={cx - 12}
                  y={cy - 30}
                  width={24}
                  height={16}
                  rx={4}
                  fill="#447cef"
                />
                <text
                  x={cx}
                  y={cy - 18}
                  fill="#ffffff"
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={700}
                >
                  {data[index]?.value ?? ''}
                </text>
                <circle cx={cx} cy={cy} r={4} fill="#447cef" stroke="#ffffff" strokeWidth={2} />
              </g>
            )
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default ReportDetailsChart
