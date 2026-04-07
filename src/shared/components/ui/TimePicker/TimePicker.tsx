import { useMemo } from 'react'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { TimePicker as MuiTimePicker } from '@mui/x-date-pickers/TimePicker'
import dayjs, { type Dayjs } from 'dayjs'

interface TimePickerProps {
  ariaLabel?: string
  disabled?: boolean
  minuteStep?: number
  onChange: (value: string) => void
  placeholder?: string
  value: string
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

const parseTimeValue = (value: string): Dayjs | null => {
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return null
  }

  const match = trimmedValue.match(TIME_PATTERN)
  if (!match) {
    return null
  }

  const hour = Number.parseInt(match[1], 10)
  const minute = Number.parseInt(match[2], 10)
  return dayjs().startOf('day').hour(hour).minute(minute).second(0).millisecond(0)
}

function TimePicker({
  ariaLabel = 'Select time',
  disabled = false,
  minuteStep = 30,
  onChange,
  placeholder = 'Select time',
  value,
}: TimePickerProps) {
  const pickerValue = useMemo(() => parseTimeValue(value), [value])
  const safeMinuteStep = Number.isInteger(minuteStep) && minuteStep > 0 ? minuteStep : 30

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <MuiTimePicker
        ampm
        disabled={disabled}
        timeSteps={{ minutes: safeMinuteStep }}
        value={pickerValue}
        onChange={(nextValue) => {
          if (!nextValue || !nextValue.isValid()) {
            onChange('')
            return
          }

          onChange(nextValue.format('HH:mm'))
        }}
        slotProps={{
          textField: {
            fullWidth: true,
            placeholder,
            size: 'small',
            sx: {
              '& .MuiInputBase-root': {
                minHeight: '38px',
                backgroundColor: '#f9fbff',
                fontFamily: 'var(--font-family-body)',
                fontSize: '14px',
              },
              '& .MuiInputBase-input': {
                paddingBlock: '8px',
              },
            },
            'aria-label': ariaLabel,
          },
        }}
      />
    </LocalizationProvider>
  )
}

export default TimePicker
