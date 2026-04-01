import { useRef } from 'react'
import styles from './OtpCodeField.module.css'

type OtpCodeFieldProps<TName extends string> = {
  id: string
  name: TName
  label: string
  value: string
  length?: number
  onValueChange: (name: TName, value: string) => void
  disabled?: boolean
}

const sanitizeOtp = (value: string, length: number) => value.replace(/\D/g, '').slice(0, length)

function OtpCodeField<TName extends string>({
  id,
  name,
  label,
  value,
  length = 6,
  onValueChange,
  disabled = false,
}: OtpCodeFieldProps<TName>) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])

  const digits = Array.from({ length }, (_, index) => sanitizeOtp(value, length)[index] ?? '')

  const focusInput = (index: number) => {
    const input = inputRefs.current[index]
    if (input) {
      input.focus()
      input.select()
    }
  }

  const updateDigits = (nextDigits: string[]) => {
    onValueChange(name, nextDigits.join(''))
  }

  const handleChange = (index: number, rawValue: string) => {
    const numericValue = rawValue.replace(/\D/g, '')
    const nextDigits = [...digits]

    if (!numericValue) {
      nextDigits[index] = ''
      updateDigits(nextDigits)
      return
    }

    let cursor = index
    for (const char of numericValue) {
      if (cursor >= length) {
        break
      }
      nextDigits[cursor] = char
      cursor += 1
    }

    updateDigits(nextDigits)
    focusInput(Math.min(cursor, length - 1))
  }

  const handleKeyDown = (index: number, key: string) => {
    if (key === 'Backspace') {
      const nextDigits = [...digits]

      if (nextDigits[index]) {
        nextDigits[index] = ''
        updateDigits(nextDigits)
        return
      }

      if (index > 0) {
        nextDigits[index - 1] = ''
        updateDigits(nextDigits)
        focusInput(index - 1)
      }
      return
    }

    if (key === 'ArrowLeft' && index > 0) {
      focusInput(index - 1)
      return
    }

    if (key === 'ArrowRight' && index < length - 1) {
      focusInput(index + 1)
    }
  }

  const handlePaste = (index: number, text: string) => {
    const numericValue = text.replace(/\D/g, '')
    if (!numericValue) {
      return
    }

    const nextDigits = [...digits]
    let cursor = index

    for (const char of numericValue) {
      if (cursor >= length) {
        break
      }
      nextDigits[cursor] = char
      cursor += 1
    }

    updateDigits(nextDigits)
    focusInput(Math.min(cursor, length - 1))
  }

  return (
    <div className={styles.fieldGroup}>
      <div className={styles.fieldLabelRow}>
        <label htmlFor={`${id}-1`} className={styles.fieldLabel}>
          {label}
        </label>
      </div>

      <div className={styles.inputRow}>
        {digits.map((digit, index) => (
          <input
            key={`${id}-${index + 1}`}
            id={`${id}-${index + 1}`}
            ref={(element) => {
              inputRefs.current[index] = element
            }}
            type="text"
            value={digit}
            disabled={disabled}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            className={styles.digitInput}
            maxLength={length}
            aria-label={`OTP digit ${index + 1}`}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => handleChange(index, event.currentTarget.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'Backspace' ||
                event.key === 'ArrowLeft' ||
                event.key === 'ArrowRight'
              ) {
                event.preventDefault()
                handleKeyDown(index, event.key)
              }
            }}
            onPaste={(event) => {
              event.preventDefault()
              handlePaste(index, event.clipboardData.getData('text'))
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default OtpCodeField
