import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type UIEvent } from 'react'
import { FaCheck, FaPlus, FaRegStar, FaStar, FaTimes, FaTrashAlt } from 'react-icons/fa'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { todoService } from '@/features/todos/services/todo.service'
import type { TodoItem, TodoPayload } from '@/features/todos/types/todo-api'
import { defaultHeaderProfile, sidebarBottomItems, sidebarLogo, sidebarMenuItems } from '@/layouts/config/navigation'
import Header from '@/layouts/Header/Header'
import MainLayout from '@/layouts/MainLayout/MainLayout'
import Sidebar from '@/layouts/Sidebar/Sidebar'
import { getErrorMessage } from '@/shared/api/api-error'
import Toast from '@/shared/components/feedback/Toast'
import PhotoUploadField from '@/shared/components/media/PhotoUploadField/PhotoUploadField'
import ConfirmModal from '@/shared/components/ui/ConfirmModal/ConfirmModal'
import { useHeaderProfile } from '@/shared/hooks/useHeaderProfile'
import { useResponsiveSidebar } from '@/shared/hooks/useResponsiveSidebar'
import { useToast } from '@/shared/hooks/useToast'
import type { SidebarItemKey } from '@/shared/types/layout'
import styles from './ToDoListPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'to-do'
const SEARCH_DEBOUNCE_MS = 300
const TODO_LIST_PAGE_SIZE = 20

type TodoDateFilter = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_YEAR'
type TodoPriorityFilter = 'ALL' | 'FAVORITES'

const DATE_FILTER_OPTIONS: Array<{ label: string; value: TodoDateFilter }> = [
  { label: 'Today', value: 'TODAY' },
  { label: 'This Week', value: 'THIS_WEEK' },
  { label: 'This Month', value: 'THIS_MONTH' },
  { label: 'This Year', value: 'THIS_YEAR' },
]

const PRIORITY_FILTER_OPTIONS: Array<{ label: string; value: TodoPriorityFilter }> = [
  { label: 'All Tasks', value: 'ALL' },
  { label: 'Priorities', value: 'FAVORITES' },
]

interface TodoFormState {
  endDate: string
  image: string
  isDone: boolean
  starred: boolean
  startDate: string
  text: string
}

interface ToDoListPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

const getTodayDate = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const createDefaultTodoForm = (): TodoFormState => {
  const today = getTodayDate()

  return {
    endDate: today,
    image: '',
    isDone: false,
    starred: false,
    startDate: today,
    text: '',
  }
}

const mapTodoToForm = (todo: TodoItem): TodoFormState => {
  const fallbackDate = getTodayDate()

  return {
    endDate: todo.endDate?.trim() || todo.startDate?.trim() || fallbackDate,
    image: todo.image?.trim() || '',
    isDone: todo.isDone === true,
    starred: Boolean(todo.starred),
    startDate: todo.startDate?.trim() || fallbackDate,
    text: todo.text?.trim() || '',
  }
}

const buildTodoPayload = (form: TodoFormState): TodoPayload => {
  const payload: TodoPayload = {
    endDate: form.endDate.trim(),
    isDone: form.isDone,
    starred: form.starred,
    startDate: form.startDate.trim(),
    text: form.text.trim(),
  }

  const trimmedImage = form.image.trim()
  if (trimmedImage) {
    payload.image = trimmedImage
  }

  return payload
}

const isValidDateRange = (startDate: string, endDate: string) => endDate >= startDate

const toDateString = (value: Date) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const resolveDateFilterRange = (dateFilter: TodoDateFilter) => {
  const currentDate = new Date()
  const rangeStart = new Date(currentDate)
  const rangeEnd = new Date(currentDate)

  if (dateFilter === 'TODAY') {
    return {
      startDateFrom: toDateString(rangeStart),
      startDateTo: toDateString(rangeEnd),
    }
  }

  if (dateFilter === 'THIS_WEEK') {
    const currentDay = currentDate.getDay()
    const daysFromWeekStart = (currentDay + 6) % 7
    rangeStart.setDate(currentDate.getDate() - daysFromWeekStart)
    rangeEnd.setDate(rangeStart.getDate() + 6)

    return {
      startDateFrom: toDateString(rangeStart),
      startDateTo: toDateString(rangeEnd),
    }
  }

  if (dateFilter === 'THIS_MONTH') {
    rangeStart.setDate(1)
    rangeEnd.setMonth(rangeEnd.getMonth() + 1, 0)

    return {
      startDateFrom: toDateString(rangeStart),
      startDateTo: toDateString(rangeEnd),
    }
  }

  rangeStart.setMonth(0, 1)
  rangeEnd.setMonth(11, 31)

  return {
    startDateFrom: toDateString(rangeStart),
    startDateTo: toDateString(rangeEnd),
  }
}

const toTimestamp = (value?: string | null) => {
  if (!value) {
    return 0
  }

  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime()
}

const sortTodosByPriority = (todoList: TodoItem[]) =>
  [...todoList].sort((firstTodo, secondTodo) => {
    const isFirstStarred = firstTodo.starred === true
    const isSecondStarred = secondTodo.starred === true

    if (isFirstStarred !== isSecondStarred) {
      return isFirstStarred ? -1 : 1
    }

    const createdDateDifference = toTimestamp(secondTodo.createdDate) - toTimestamp(firstTodo.createdDate)
    if (createdDateDifference !== 0) {
      return createdDateDifference
    }

    return toTimestamp(secondTodo.updatedDate) - toTimestamp(firstTodo.updatedDate)
  })

const formatDateLabel = (value?: string | null) => {
  if (!value) {
    return 'N/A'
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return parsedDate.toLocaleDateString('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function ToDoListPage({ onLogout, session }: ToDoListPageProps) {
  const [searchValue, setSearchValue] = useState('')
  const [activeDateFilter, setActiveDateFilter] = useState<TodoDateFilter>('THIS_WEEK')
  const [activePriorityFilter, setActivePriorityFilter] = useState<TodoPriorityFilter>('ALL')
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMoreTodos, setHasMoreTodos] = useState(false)
  const [isLoadingMoreTodos, setIsLoadingMoreTodos] = useState(false)
  const [isLoadingTodos, setIsLoadingTodos] = useState(false)
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(false)
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null)
  const [todoForm, setTodoForm] = useState<TodoFormState>(createDefaultTodoForm)
  const [isSavingTodo, setIsSavingTodo] = useState(false)
  const [todoIdBeingDeleted, setTodoIdBeingDeleted] = useState<string | null>(null)
  const [todoIdBeingStarred, setTodoIdBeingStarred] = useState<string | null>(null)
  const [todoIdBeingDone, setTodoIdBeingDone] = useState<string | null>(null)
  const [todoIdBeingLoaded, setTodoIdBeingLoaded] = useState<string | null>(null)
  const [viewingTodo, setViewingTodo] = useState<TodoItem | null>(null)
  const [pendingDeleteTodo, setPendingDeleteTodo] = useState<{ id: string; text: string } | null>(null)
  const activeLoadRequestRef = useRef(0)
  const canTriggerLoadMoreRef = useRef(true)
  const isLoadingMoreTodosRef = useRef(false)
  const skeletonCardIndexes = useMemo(() => Array.from({ length: 6 }, (_, index) => index), [])

  const { clearToast, showToast, toast } = useToast()
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const resolvedHeaderProfile = useHeaderProfile({
    fallbackProfile: defaultHeaderProfile,
    session,
  })
  const accessToken = session?.accessToken?.trim() ?? ''

  const closeTodoModal = useCallback(() => {
    setIsTodoModalOpen(false)
    setEditingTodoId(null)
    setTodoForm(createDefaultTodoForm())
  }, [])

  const closeViewTodoModal = useCallback(() => {
    setViewingTodo(null)
  }, [])

  const loadTodos = useCallback(
    async (options: { append?: boolean; page?: number; searchTerm: string }) => {
      if (!accessToken) {
        setTodos([])
        setViewingTodo(null)
        setCurrentPage(0)
        setHasMoreTodos(false)
        return
      }

      const requestId = activeLoadRequestRef.current + 1
      activeLoadRequestRef.current = requestId
      const shouldAppend = Boolean(options.append)
      const targetPage = Math.max(0, options.page ?? 0)

      if (shouldAppend) {
        setIsLoadingMoreTodos(true)
      } else {
        setIsLoadingTodos(true)
      }

      try {
        const dateRangeQuery = resolveDateFilterRange(activeDateFilter)
        const result = await todoService.list(accessToken, {
          page: targetPage,
          size: TODO_LIST_PAGE_SIZE,
          ...dateRangeQuery,
          search: options.searchTerm.trim() || undefined,
          starred: activePriorityFilter === 'FAVORITES' ? true : undefined,
          sortBy: 'createdDate',
          sortDir: 'desc',
        })

        if (requestId !== activeLoadRequestRef.current) {
          return
        }

        setTodos((currentTodos) => {
          const nextTodos = sortTodosByPriority(Array.isArray(result.items) ? result.items : [])
          if (!shouldAppend) {
            return nextTodos
          }

          const todoMap = new Map(currentTodos.map((todo) => [todo.id, todo]))
          nextTodos.forEach((todo) => {
            todoMap.set(todo.id, todo)
          })

          return sortTodosByPriority(Array.from(todoMap.values()))
        })
        setCurrentPage(result.page)
        setHasMoreTodos(!result.isLast && result.page + 1 < result.totalPages)
      } catch (error) {
        if (requestId !== activeLoadRequestRef.current) {
          return
        }

        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        if (requestId === activeLoadRequestRef.current) {
          if (shouldAppend) {
            setIsLoadingMoreTodos(false)
          } else {
            setIsLoadingTodos(false)
          }
        }
      }
    },
    [accessToken, activeDateFilter, activePriorityFilter, showToast],
  )

  useEffect(() => {
    clearToast()
  }, [clearToast])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadTodos({ page: 0, searchTerm: searchValue })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(handle)
    }
  }, [loadTodos, searchValue])

  useEffect(() => {
    setViewingTodo((currentViewingTodo) => {
      if (!currentViewingTodo) {
        return currentViewingTodo
      }

      return todos.find((todo) => todo.id === currentViewingTodo.id) ?? null
    })
  }, [todos])

  const handleTodoListScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!hasMoreTodos || isLoadingTodos || isLoadingMoreTodos || isLoadingMoreTodosRef.current) {
      return
    }

    const scrollElement = event.currentTarget
    const distanceFromBottom =
      scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight

    if (distanceFromBottom > 180) {
      canTriggerLoadMoreRef.current = true
      return
    }

    if (distanceFromBottom <= 120 && canTriggerLoadMoreRef.current) {
      canTriggerLoadMoreRef.current = false
      isLoadingMoreTodosRef.current = true

      const loadMore = async () => {
        try {
          await loadTodos({
            append: true,
            page: currentPage + 1,
            searchTerm: searchValue,
          })
        } finally {
          isLoadingMoreTodosRef.current = false
        }
      }

      void loadMore()
    }
  }

  const handleOpenCreateModal = () => {
    setEditingTodoId(null)
    setTodoForm(createDefaultTodoForm())
    setIsTodoModalOpen(true)
  }

  const handleOpenEditModal = (todoId: string) => {
    if (!accessToken) {
      showToast('You need to sign in before managing tasks.', { variant: 'error' })
      return
    }

    const openEditor = async () => {
      setTodoIdBeingLoaded(todoId)

      try {
        const todo = await todoService.getOne(todoId, accessToken)
        setEditingTodoId(todo.id)
        setTodoForm(mapTodoToForm(todo))
        setIsTodoModalOpen(true)
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setTodoIdBeingLoaded(null)
      }
    }

    void openEditor()
  }

  const handleTodoSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!accessToken) {
      showToast('You need to sign in before managing tasks.', { variant: 'error' })
      return
    }

    const trimmedText = todoForm.text.trim()
    const trimmedStartDate = todoForm.startDate.trim()
    const trimmedEndDate = todoForm.endDate.trim()

    if (!trimmedText || !trimmedStartDate || !trimmedEndDate) {
      showToast('Text, start date, and end date are required.', { variant: 'error' })
      return
    }

    if (!isValidDateRange(trimmedStartDate, trimmedEndDate)) {
      showToast('End date must be on or after start date.', { variant: 'error' })
      return
    }

    const persistTodo = async () => {
      setIsSavingTodo(true)

      try {
        const payload = buildTodoPayload(todoForm)

        if (editingTodoId) {
          await todoService.update(editingTodoId, payload, accessToken)
          showToast('Task updated successfully.', { variant: 'success' })
        } else {
          await todoService.create(payload, accessToken)
          showToast('Task created successfully.', { variant: 'success' })
        }

        closeTodoModal()
        await loadTodos({ page: 0, searchTerm: searchValue })
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setIsSavingTodo(false)
      }
    }

    void persistTodo()
  }

  const handleToggleStarred = (todo: TodoItem) => {
    if (!accessToken) {
      showToast('You need to sign in before managing tasks.', { variant: 'error' })
      return
    }

    const nextStarred = todo.starred !== true

    const toggleStarred = async () => {
      setTodoIdBeingStarred(todo.id)

      try {
        const updatedTodo = await todoService.setStarred(todo.id, nextStarred, accessToken)

        setTodos((currentTodos) => {
          const nextTodos = currentTodos.map((currentTodo) => {
            if (currentTodo.id !== todo.id) {
              return currentTodo
            }

            if (updatedTodo && typeof updatedTodo === 'object') {
              return {
                ...currentTodo,
                ...updatedTodo,
                starred: updatedTodo.starred === true,
              }
            }

            return {
              ...currentTodo,
              starred: nextStarred,
            }
          })

          const filteredTodos =
            activePriorityFilter === 'FAVORITES'
              ? nextTodos.filter((currentTodo) => currentTodo.starred === true)
              : nextTodos

          return sortTodosByPriority(filteredTodos)
        })
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setTodoIdBeingStarred(null)
      }
    }

    void toggleStarred()
  }

  const handleToggleDone = (todo: TodoItem, isDone: boolean) => {
    if (!accessToken) {
      showToast('You need to sign in before managing tasks.', { variant: 'error' })
      return
    }

    const toggleDone = async () => {
      setTodoIdBeingDone(todo.id)

      try {
        const updatedTodo = await todoService.setDone(todo.id, isDone, accessToken)

        setTodos((currentTodos) =>
          sortTodosByPriority(
            currentTodos.map((currentTodo) => {
              if (currentTodo.id !== todo.id) {
                return currentTodo
              }

              if (updatedTodo && typeof updatedTodo === 'object') {
                return {
                  ...currentTodo,
                  ...updatedTodo,
                  isDone: updatedTodo.isDone === true,
                }
              }

              return {
                ...currentTodo,
                isDone,
              }
            }),
          ),
        )

        setViewingTodo((currentViewingTodo) => {
          if (!currentViewingTodo || currentViewingTodo.id !== todo.id) {
            return currentViewingTodo
          }

          if (updatedTodo && typeof updatedTodo === 'object') {
            return {
              ...currentViewingTodo,
              ...updatedTodo,
              isDone: updatedTodo.isDone === true,
            }
          }

          return {
            ...currentViewingTodo,
            isDone,
          }
        })
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setTodoIdBeingDone(null)
      }
    }

    void toggleDone()
  }

  const handleDeleteTodo = (todoId: string) => {
    if (!accessToken) {
      setPendingDeleteTodo(null)
      showToast('You need to sign in before managing tasks.', { variant: 'error' })
      return
    }

    const removeTodo = async () => {
      setTodoIdBeingDeleted(todoId)

      try {
        await todoService.delete(todoId, accessToken)
        setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== todoId))
        setViewingTodo((currentViewingTodo) => (currentViewingTodo?.id === todoId ? null : currentViewingTodo))
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setPendingDeleteTodo(null)
        setTodoIdBeingDeleted(null)
      }
    }

    void removeTodo()
  }

  const handleDeleteTodoRequest = (todo: TodoItem) => {
    setPendingDeleteTodo({
      id: todo.id,
      text: todo.text?.trim() || 'this task',
    })
  }

  const handleViewTodoDetails = (todoId: string) => {
    if (!accessToken) {
      showToast('You need to sign in before viewing task details.', { variant: 'error' })
      return
    }

    const viewTodoDetails = async () => {
      setTodoIdBeingLoaded(todoId)

      try {
        const todo = await todoService.getOne(todoId, accessToken)
        setViewingTodo(todo)
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setTodoIdBeingLoaded(null)
      }
    }

    void viewTodoDetails()
  }

  const handleViewEdit = () => {
    if (!viewingTodo) {
      return
    }

    const todoToEdit = viewingTodo
    closeViewTodoModal()
    handleOpenEditModal(todoToEdit.id)
  }

  const handleViewDelete = () => {
    if (!viewingTodo) {
      return
    }

    handleDeleteTodoRequest(viewingTodo)
    closeViewTodoModal()
  }

  const handleViewToggleDone = () => {
    if (!viewingTodo) {
      return
    }

    handleToggleDone(viewingTodo, viewingTodo.isDone !== true)
  }

  const handleDeleteTodoConfirm = () => {
    if (!pendingDeleteTodo) {
      return
    }

    handleDeleteTodo(pendingDeleteTodo.id)
  }

  return (
    <MainLayout
      isSidebarOpen={isSidebarOpen}
      onSidebarClose={() => {
        setIsSidebarOpen(false)
      }}
      header={
        <Header
          profile={resolvedHeaderProfile}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          isMenuOpen={isSidebarOpen}
          onMenuToggle={() => {
            setIsSidebarOpen((prevState) => !prevState)
          }}
        />
      }
      sidebar={
        <Sidebar
          session={session}
          activeItem={ACTIVE_MENU_ITEM}
          logoSrc={sidebarLogo}
          menuItems={sidebarMenuItems}
          bottomItems={sidebarBottomItems}
          onLogout={onLogout}
        />
      }
    >
      <Toast toast={toast} onClose={clearToast} />

      <div className={styles.page}>
        <section className={styles.container}>
          <div className={styles.headingRow}>
            <h1 className={styles.pageTitle}>To-Do List</h1>
          </div>

          <div className={styles.filtersRow}>
            <div className={styles.periodTabs} role="tablist" aria-label="To-do date range">
              {DATE_FILTER_OPTIONS.map((dateFilterOption) => {
                const isActive = activeDateFilter === dateFilterOption.value

                return (
                  <button
                    key={dateFilterOption.value}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`${styles.periodTab} ${isActive ? styles.periodTabActive : ''}`}
                    onClick={() => {
                      setActiveDateFilter(dateFilterOption.value)
                    }}
                  >
                    {dateFilterOption.label}
                  </button>
                )
              })}
            </div>

            <div className={styles.prioritySwitch} role="tablist" aria-label="To-do priority filter">
              {PRIORITY_FILTER_OPTIONS.map((priorityFilterOption) => {
                const isActive = activePriorityFilter === priorityFilterOption.value

                return (
                  <button
                    key={priorityFilterOption.value}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`${styles.priorityChip} ${isActive ? styles.priorityChipActive : ''}`}
                    onClick={() => {
                      setActivePriorityFilter(priorityFilterOption.value)
                    }}
                  >
                    {priorityFilterOption.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className={styles.listPanel}>
            <div className={styles.list} onScroll={handleTodoListScroll}>
              {isLoadingTodos ? (
                skeletonCardIndexes.map((cardIndex) => (
                  <article key={`todo-skeleton-${cardIndex}`} className={`${styles.todoItem} ${styles.skeletonItem}`} aria-hidden="true">
                    <span className={styles.skeletonCheckbox} />
                    <span className={styles.skeletonText} />
                    <span className={styles.skeletonActions} />
                  </article>
                ))
              ) : todos.length === 0 ? (
                <div className={styles.emptyState}>No tasks found. Add a new task to get started.</div>
              ) : (
                todos.map((todo) => {
                  const isCompleted = todo.isDone === true
                  const isActionDisabled =
                    todoIdBeingDeleted === todo.id ||
                    todoIdBeingStarred === todo.id ||
                    todoIdBeingLoaded === todo.id ||
                    todoIdBeingDone === todo.id

                  return (
                    <article
                      key={todo.id}
                      className={[styles.todoItem, isCompleted ? styles.todoItemCompleted : ''].join(' ')}
                      onClick={() => {
                        handleViewTodoDetails(todo.id)
                      }}
                    >
                      <label
                        className={styles.checkboxControl}
                        onClick={(event) => {
                          event.stopPropagation()
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isCompleted}
                          onChange={(event) => {
                            handleToggleDone(todo, event.target.checked)
                          }}
                          disabled={isActionDisabled}
                          className={styles.checkboxInput}
                          aria-label={`Mark ${todo.text ?? 'task'} as completed`}
                        />
                        <span className={styles.checkboxVisual}>{isCompleted ? <FaCheck aria-hidden="true" /> : null}</span>
                      </label>

                      <div className={styles.todoContent}>
                        <p className={styles.todoTextButton}>{todo.text?.trim() || 'Untitled Task'}</p>
                        <p className={styles.todoDateRange}>
                          {todo.startDate || 'N/A'} - {todo.endDate || 'N/A'}
                        </p>
                      </div>

                      {isCompleted ? (
                        <button
                          type="button"
                          className={styles.completedDeleteButton}
                          aria-label={`Delete ${todo.text ?? 'task'}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleDeleteTodoRequest(todo)
                          }}
                          disabled={isActionDisabled}
                        >
                          <FaTrashAlt aria-hidden="true" />
                        </button>
                      ) : (
                        <div
                          className={styles.itemActions}
                          onClick={(event) => {
                            event.stopPropagation()
                          }}
                        >
                          <button
                            type="button"
                            className={styles.iconButton}
                            aria-label={todo.starred === true ? 'Remove from favorites' : 'Set as favorite'}
                            onClick={() => {
                              handleToggleStarred(todo)
                            }}
                            disabled={isActionDisabled}
                          >
                            {todo.starred === true ? (
                              <FaStar aria-hidden="true" className={styles.starFilled} />
                            ) : (
                              <FaRegStar aria-hidden="true" className={styles.starEmpty} />
                            )}
                          </button>
                          <button
                            type="button"
                            className={styles.iconButton}
                            aria-label={`Delete ${todo.text ?? 'task'}`}
                            onClick={() => {
                              handleDeleteTodoRequest(todo)
                            }}
                            disabled={isActionDisabled}
                          >
                            <FaTimes aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </article>
                  )
                })
              )}
            </div>

            <button type="button" className={styles.floatingAddButton} aria-label="Add task" onClick={handleOpenCreateModal}>
              <span className={styles.floatingAddIcon}>
                <FaPlus aria-hidden="true" />
              </span>
              <span className={styles.floatingAddLabel}>Add Task</span>
            </button>
          </div>
        </section>
      </div>

      {viewingTodo ? (
        <div className={styles.modalOverlay} onClick={closeViewTodoModal}>
          <div
            className={`${styles.modalCard} ${styles.viewModalCard}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="todo-details-title"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className={styles.modalHeader}>
              <h2 id="todo-details-title" className={styles.modalTitle}>
                Task Details
              </h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                aria-label="Close task details"
                onClick={closeViewTodoModal}
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className={styles.viewModalBody}>
              {viewingTodo.image?.trim() ? (
                <div className={styles.viewImageWrap}>
                  <img
                    src={viewingTodo.image}
                    alt={viewingTodo.text?.trim() || 'Task image'}
                    className={styles.viewImage}
                    loading="lazy"
                  />
                </div>
              ) : null}

              <div className={styles.viewDetailsGrid}>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Task</span>
                  <span className={styles.viewDetailValue}>{viewingTodo.text?.trim() || 'Untitled Task'}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Start Date</span>
                  <span className={styles.viewDetailValue}>{formatDateLabel(viewingTodo.startDate)}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>End Date</span>
                  <span className={styles.viewDetailValue}>{formatDateLabel(viewingTodo.endDate)}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Priority</span>
                  <span className={styles.viewDetailValue}>{viewingTodo.starred === true ? 'Starred' : 'Normal'}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Status</span>
                  <span className={styles.viewDetailValue}>{viewingTodo.isDone === true ? 'Done' : 'Pending'}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Created</span>
                  <span className={styles.viewDetailValue}>{formatDateLabel(viewingTodo.createdDate)}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Updated</span>
                  <span className={styles.viewDetailValue}>{formatDateLabel(viewingTodo.updatedDate)}</span>
                </div>
              </div>
            </div>

            <div className={`${styles.modalActions} ${styles.viewModalActions}`}>
              <button type="button" className={styles.cancelButton} onClick={closeViewTodoModal}>
                Close
              </button>
              <button
                type="button"
                className={`${styles.submitButton} ${styles.viewDoneButton}`}
                onClick={handleViewToggleDone}
                disabled={todoIdBeingDone === viewingTodo.id}
              >
                {todoIdBeingDone === viewingTodo.id
                  ? 'Updating...'
                  : viewingTodo.isDone === true
                    ? 'Mark as undone'
                    : 'Mark as done'}
              </button>
              <button type="button" className={styles.submitButton} onClick={handleViewEdit}>
                Edit
              </button>
              <button type="button" className={`${styles.submitButton} ${styles.viewDeleteButton}`} onClick={handleViewDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isTodoModalOpen ? (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            closeTodoModal()
          }}
        >
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="todo-form-title"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className={styles.modalHeader}>
              <h2 id="todo-form-title" className={styles.modalTitle}>
                {editingTodoId ? 'Edit Task' : 'Add New Task'}
              </h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                aria-label="Close task form"
                onClick={() => {
                  closeTodoModal()
                }}
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={handleTodoSubmit} noValidate>
              <label className={styles.fieldLabel}>
                <span>
                  Task Text <span className={styles.requiredMark}>*</span>
                </span>
                <input
                  type="text"
                  value={todoForm.text}
                  onChange={(event) => {
                    setTodoForm((currentForm) => ({ ...currentForm, text: event.target.value }))
                  }}
                  className={styles.fieldInput}
                  placeholder="e.g. Buy dog food"
                  required
                />
              </label>

              <div>
                <PhotoUploadField
                  cropAspectRatio={1}
                  value={todoForm.image}
                  onChange={(nextImage) => {
                    setTodoForm((currentForm) => ({ ...currentForm, image: nextImage }))
                  }}
                  onNotify={(message, variant) => {
                    showToast(message, { variant })
                  }}
                  title="Task Image"
                  subtitle="Upload a task image from your device or camera. Optional."
                  previewAlt={todoForm.text ? `${todoForm.text} image` : 'Task image preview'}
                  uploadFolder="todos"
                />
              </div>

              <div className={styles.dateFieldRow}>
                <label className={styles.fieldLabel}>
                  <span>
                    Start Date <span className={styles.requiredMark}>*</span>
                  </span>
                  <input
                    type="date"
                    value={todoForm.startDate}
                    onChange={(event) => {
                      setTodoForm((currentForm) => ({ ...currentForm, startDate: event.target.value }))
                    }}
                    className={styles.fieldInput}
                    required
                  />
                </label>

                <label className={styles.fieldLabel}>
                  <span>
                    End Date <span className={styles.requiredMark}>*</span>
                  </span>
                  <input
                    type="date"
                    value={todoForm.endDate}
                    min={todoForm.startDate || undefined}
                    onChange={(event) => {
                      setTodoForm((currentForm) => ({ ...currentForm, endDate: event.target.value }))
                    }}
                    className={styles.fieldInput}
                    required
                  />
                </label>
              </div>

              <label className={styles.starredField}>
                <input
                  type="checkbox"
                  checked={todoForm.starred}
                  onChange={(event) => {
                    setTodoForm((currentForm) => ({ ...currentForm, starred: event.target.checked }))
                  }}
                />
                <span>Mark as favorite</span>
              </label>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => {
                    closeTodoModal()
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.submitButton} disabled={isSavingTodo}>
                  {isSavingTodo ? 'Saving...' : editingTodoId ? 'Save Task' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={pendingDeleteTodo !== null}
        title="Delete task?"
        message={`Are you sure you want to delete ${pendingDeleteTodo?.text ?? 'this task'}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        ariaLabel="Delete task confirmation"
        isBusy={todoIdBeingDeleted !== null}
        onCancel={() => {
          setPendingDeleteTodo(null)
        }}
        onConfirm={handleDeleteTodoConfirm}
      />
    </MainLayout>
  )
}

export default ToDoListPage



