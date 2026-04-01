import { useEffect, useMemo, useRef, useState } from 'react'
import { FaChevronDown } from 'react-icons/fa'
import styles from './PillMultiSelectDropdown.module.css'

export interface PillMultiSelectOption {
  label: string
  value: string
}

interface PillMultiSelectDropdownProps {
  applyLabel?: string
  helperText?: string
  onApply: (values: string[]) => void
  options: PillMultiSelectOption[]
  panelAlign?: 'left' | 'right'
  panelTitle: string
  placeholder: string
  selectedValues: string[]
}

function PillMultiSelectDropdown({
  applyLabel = 'Apply Now',
  helperText,
  onApply,
  options,
  panelAlign = 'left',
  panelTitle,
  placeholder,
  selectedValues,
}: PillMultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [draftValues, setDraftValues] = useState<string[]>(selectedValues)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setDraftValues(selectedValues)
  }, [selectedValues])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleDocumentPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentPointerDown)

    return () => {
      document.removeEventListener('mousedown', handleDocumentPointerDown)
    }
  }, [isOpen])

  const labelByValue = useMemo(() => {
    const map = new Map<string, string>()
    options.forEach((option) => {
      map.set(option.value, option.label)
    })
    return map
  }, [options])

  const triggerLabel = useMemo(() => {
    if (selectedValues.length === 0) {
      return placeholder
    }

    if (selectedValues.length === 1) {
      return labelByValue.get(selectedValues[0]) ?? selectedValues[0]
    }

    return `${selectedValues.length} Selected`
  }, [labelByValue, placeholder, selectedValues])

  const toggleValue = (value: string) => {
    setDraftValues((currentValues) => {
      if (currentValues.includes(value)) {
        return currentValues.filter((currentValue) => currentValue !== value)
      }

      return [...currentValues, value]
    })
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => {
          setDraftValues(selectedValues)
          setIsOpen(true)
        }}
      >
        <span>{triggerLabel}</span>
        <FaChevronDown aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className={`${styles.panel}${panelAlign === 'right' ? ` ${styles.panelAlignRight}` : ''}`}>
          <h3 className={styles.title}>{panelTitle}</h3>

          <div className={styles.pillGrid}>
            {options.map((option) => {
              const isSelected = draftValues.includes(option.value)

              return (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.pillButton}${isSelected ? ` ${styles.pillButtonSelected}` : ''}`}
                  onClick={() => {
                    toggleValue(option.value)
                  }}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          {helperText ? <p className={styles.helperText}>{helperText}</p> : null}

          <button
            type="button"
            className={styles.applyButton}
            onClick={() => {
              onApply(draftValues)
              setIsOpen(false)
            }}
          >
            {applyLabel}
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default PillMultiSelectDropdown
