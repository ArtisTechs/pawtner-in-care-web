export type TodoSortBy =
  | 'id'
  | 'text'
  | 'startDate'
  | 'endDate'
  | 'starred'
  | 'isDone'
  | 'createdDate'
  | 'updatedDate'

export type TodoSortDirection = 'asc' | 'desc'

export interface TodoItem {
  createdDate?: string | null
  endDate?: string | null
  id: string
  image?: string | null
  isDone?: boolean | null
  starred?: boolean | null
  startDate?: string | null
  text?: string | null
  updatedDate?: string | null
}

export interface TodoPayload {
  endDate: string
  image?: string
  isDone?: boolean
  starred?: boolean
  startDate: string
  text: string
}

export interface TodoListQuery {
  endDateFrom?: string
  endDateTo?: string
  ignorePagination?: boolean
  page?: number
  search?: string
  size?: number
  sortBy?: TodoSortBy
  sortDir?: TodoSortDirection
  starred?: boolean
  isDone?: boolean
  startDateFrom?: string
  startDateTo?: string
  text?: string
}

export interface TodoListResult {
  isFirst: boolean
  isLast: boolean
  items: TodoItem[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}
