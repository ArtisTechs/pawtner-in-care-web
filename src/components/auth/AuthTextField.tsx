import { useState } from 'react'
import type { ChangeEvent } from 'react'
import type { AuthFieldType } from '../../types/auth'
import styles from './AuthTextField.module.css'

type AuthTextFieldProps<TName extends string> = {
  id: string
  name: TName
  label: string
  type: AuthFieldType
  value: string
  placeholder: string
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
        </label>
        {actionText && actionPlacement === 'inline' ? (
          <button type="button" className={styles.inlineAction} onClick={onActionClick}>
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
          className={`${styles.textInput} ${isPasswordField ? styles.passwordInput : ''}`}
          autoComplete={type === 'email' ? 'email' : 'current-password'}
          onChange={handleChange}
        />

        {isPasswordField ? (
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setIsPasswordVisible((currentState) => !currentState)}
            aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
            aria-pressed={isPasswordVisible}
          >
            {isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        ) : null}
      </div>
      {actionText && actionPlacement === 'below' ? (
        <div className={styles.belowActionRow}>
          <button type="button" className={styles.inlineAction} onClick={onActionClick}>
            {actionText}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={styles.eyeIcon}
    >
      <path
        d="M2 12C3.8 8.3 7.4 6 12 6C16.6 6 20.2 8.3 22 12C20.2 15.7 16.6 18 12 18C7.4 18 3.8 15.7 2 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={styles.eyeIcon}
    >
      <path
        d="M2 12C3.8 8.3 7.4 6 12 6C16.6 6 20.2 8.3 22 12C20.2 15.7 16.6 18 12 18C7.4 18 3.8 15.7 2 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4 4L20 20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default AuthTextField
