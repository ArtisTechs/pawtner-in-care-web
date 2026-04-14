import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import type { AuthFieldType } from '@/features/auth/types/auth'
import styles from './AuthTextField.module.css'

type AuthTextFieldProps<TName extends string> = {
  id: string
  name: TName
  label: string
  type: AuthFieldType
  value: string
  placeholder: string
  autoComplete?: string
  disabled?: boolean
  required?: boolean
  errorMessage?: string
  actionText?: string
  actionPlacement?: 'inline' | 'below'
  onValueChange: (name: TName, value: string) => void
  onActionClick?: () => void
}

function AuthTextField<TName extends string>({
  id,
  name,
  label,
  type,
  value,
  placeholder,
  autoComplete,
  disabled = false,
  required = false,
  errorMessage,
  actionText,
  actionPlacement = 'inline',
  onValueChange,
  onActionClick,
}: AuthTextFieldProps<TName>) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const isPasswordField = type === 'password'
  const effectiveInputType = isPasswordField && isPasswordVisible ? 'text' : type

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onValueChange(name, event.currentTarget.value)
  }

  return (
    <div className={styles.fieldGroup}>
      <div className={styles.fieldLabelRow}>
        <label htmlFor={id} className={styles.fieldLabel}>
          {label}
          {required ? <span className={styles.requiredMark}>*</span> : null}
        </label>
        {actionText && actionPlacement === 'inline' ? (
          <button
            type="button"
            className={styles.inlineAction}
            onClick={onActionClick}
            disabled={disabled}
          >
            {actionText}
          </button>
        ) : null}
      </div>
      <div className={styles.inputWrapper}>
        <input
          id={id}
          name={name}
          type={effectiveInputType}
          value={value}
          placeholder={placeholder}
          className={`${styles.textInput} ${isPasswordField ? styles.passwordInput : ''} ${errorMessage ? styles.textInputError : ''}`}
          autoComplete={autoComplete ?? (type === 'email' ? 'email' : 'current-password')}
          disabled={disabled}
          aria-required={required}
          aria-invalid={Boolean(errorMessage)}
          onChange={handleChange}
        />

        {isPasswordField ? (
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setIsPasswordVisible((currentState) => !currentState)}
            aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
            aria-pressed={isPasswordVisible}
            disabled={disabled}
          >
            {isPasswordVisible ? (
              <FaEyeSlash aria-hidden="true" className={styles.eyeIcon} />
            ) : (
              <FaEye aria-hidden="true" className={styles.eyeIcon} />
            )}
          </button>
        ) : null}
      </div>
      {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}
      {actionText && actionPlacement === 'below' ? (
        <div className={styles.belowActionRow}>
          <button
            type="button"
            className={styles.inlineAction}
            onClick={onActionClick}
            disabled={disabled}
          >
            {actionText}
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default AuthTextField
