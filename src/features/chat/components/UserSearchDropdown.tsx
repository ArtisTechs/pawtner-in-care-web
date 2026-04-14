import { useEffect, useRef, useState } from 'react'
import { FaSearch } from 'react-icons/fa'
import { userService } from '@/features/users/services/user.service'
import type { User } from '@/features/users/types/user-api'
import { getErrorMessage } from '@/shared/api/api-error'
import styles from './UserSearchDropdown.module.css'

export interface UserSearchOption {
  avatarUrl?: string | null
  displayName: string
  email?: string | null
  id: string
}

interface UserSearchDropdownProps {
  accessToken: string
  disabled?: boolean
  excludeUserId?: string
  id?: string
  label?: string
  minSearchLength?: number
  onSelect: (user: UserSearchOption | null) => void
  placeholder?: string
  selectedUser: UserSearchOption | null
}

const toDisplayName = (user: User) => {
  const firstName = user.firstName?.trim() ?? ''
  const middleName = user.middleName?.trim() ?? ''
  const lastName = user.lastName?.trim() ?? ''
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim()

  if (fullName) {
    return fullName
  }

  const email = user.email?.trim() ?? ''
  if (email) {
    return email
  }

  return user.id
}

const toSearchOption = (user: User): UserSearchOption | null => {
  const id = user.id?.trim()
  if (!id) {
    return null
  }

  return {
    avatarUrl: user.profilePicture?.trim() || null,
    displayName: toDisplayName(user),
    email: user.email?.trim() || null,
    id,
  }
}

function UserSearchDropdown({
  accessToken,
  disabled = false,
  excludeUserId,
  id = 'user-search-input',
  label = 'User',
  minSearchLength = 2,
  onSelect,
  placeholder = 'Search user by name or email',
  selectedUser,
}: UserSearchDropdownProps) {
  const [query, setQuery] = useState(selectedUser?.displayName ?? '')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<UserSearchOption[]>([])
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!selectedUser) {
      return
    }

    setQuery(selectedUser.displayName)
  }, [selectedUser])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 260)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [query])

  useEffect(() => {
    const handleWindowPointerDown = (event: MouseEvent) => {
      if (!rootRef.current || rootRef.current.contains(event.target as Node)) {
        return
      }

      setIsOpen(false)
    }

    window.addEventListener('mousedown', handleWindowPointerDown)

    return () => {
      window.removeEventListener('mousedown', handleWindowPointerDown)
    }
  }, [])

  useEffect(() => {
    if (!isOpen || !accessToken) {
      return
    }

    if (debouncedQuery.length < minSearchLength) {
      setOptions([])
      setErrorMessage('')
      setIsLoading(false)
      return
    }

    let isStopped = false

    const loadUsers = async () => {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const users = await userService.list(accessToken, {
          search: debouncedQuery,
          size: 8,
          sortBy: 'firstName',
          sortDir: 'asc',
        })

        if (isStopped) {
          return
        }

        const mappedUsers = users
          .map(toSearchOption)
          .filter((user): user is UserSearchOption => Boolean(user))
          .filter((user) => user.id !== excludeUserId)

        const dedupedUsers = Array.from(
          new Map(mappedUsers.map((user) => [user.id, user])).values(),
        )

        setOptions(dedupedUsers)
      } catch (error) {
        if (isStopped) {
          return
        }

        setOptions([])
        setErrorMessage(getErrorMessage(error))
      } finally {
        if (!isStopped) {
          setIsLoading(false)
        }
      }
    }

    void loadUsers()

    return () => {
      isStopped = true
    }
  }, [accessToken, debouncedQuery, excludeUserId, isOpen, minSearchLength])

  const shouldShowDropdown =
    isOpen && !disabled && (Boolean(query.trim()) || isLoading || Boolean(errorMessage) || options.length > 0)

  return (
    <div className={styles.root} ref={rootRef}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>

      <div className={styles.inputWrap}>
        <FaSearch className={styles.searchIcon} aria-hidden="true" />
        <input
          id={id}
          type="search"
          className={styles.input}
          value={query}
          onFocus={() => {
            setIsOpen(true)
          }}
          onChange={(event) => {
            const nextValue = event.target.value
            setQuery(nextValue)
            setIsOpen(true)

            if (selectedUser && nextValue.trim() !== selectedUser.displayName.trim()) {
              onSelect(null)
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
        />
      </div>

      {shouldShowDropdown ? (
        <div className={styles.dropdown} role="listbox" aria-label="User search suggestions">
          {isLoading ? (
            <p className={styles.dropdownMessage}>Searching users...</p>
          ) : null}

          {!isLoading && errorMessage ? (
            <p className={`${styles.dropdownMessage} ${styles.dropdownError}`}>{errorMessage}</p>
          ) : null}

          {!isLoading && !errorMessage && debouncedQuery.length < minSearchLength ? (
            <p className={styles.dropdownMessage}>
              Type at least {minSearchLength} characters.
            </p>
          ) : null}

          {!isLoading && !errorMessage && debouncedQuery.length >= minSearchLength && options.length === 0 ? (
            <p className={styles.dropdownMessage}>No matching users found.</p>
          ) : null}

          {!isLoading && !errorMessage && options.length > 0 ? (
            <ul className={styles.optionList}>
              {options.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    className={styles.optionButton}
                    onMouseDown={(event) => {
                      event.preventDefault()
                    }}
                    onClick={() => {
                      onSelect(option)
                      setQuery(option.displayName)
                      setIsOpen(false)
                    }}
                  >
                    <span className={styles.optionName}>{option.displayName}</span>
                    <span className={styles.optionMeta}>{option.email || option.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default UserSearchDropdown
