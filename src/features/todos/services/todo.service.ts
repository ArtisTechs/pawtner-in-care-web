import type { TodoItem, TodoListQuery, TodoPayload } from '@/features/todos/types/todo-api'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

type TodoListResponse = TodoItem[] | { content?: TodoItem[] | null; data?: TodoItem[] | null }
type TodoPatchResponse = TodoItem | null

const inFlightTodoListRequests = new Map<string, Promise<TodoItem[]>>()

const normalizeTodoListResponse = (value: TodoListResponse): TodoItem[] => {
  if (Array.isArray(value)) {
    return value
  }

  if (value && Array.isArray(value.content)) {
    return value.content
  }

  if (value && Array.isArray(value.data)) {
    return value.data
  }

  return []
}

const buildTodoListPath = (query?: TodoListQuery) => {
  if (!query) {
    return API_ENDPOINTS.todos.base
  }

  const params = new URLSearchParams()
  const appendIfPresent = (key: string, value?: string | number | boolean) => {
    if (value === undefined || value === null || value === '') {
      return
    }

    params.set(key, String(value))
  }

  appendIfPresent('search', query.search)
  appendIfPresent('text', query.text)
  appendIfPresent('starred', query.starred)
  appendIfPresent('isDone', query.isDone)
  appendIfPresent('startDateFrom', query.startDateFrom)
  appendIfPresent('startDateTo', query.startDateTo)
  appendIfPresent('endDateFrom', query.endDateFrom)
  appendIfPresent('endDateTo', query.endDateTo)
  appendIfPresent('page', query.page)
  appendIfPresent('size', query.size)
  appendIfPresent('sortBy', query.sortBy)
  appendIfPresent('sortDir', query.sortDir)
  appendIfPresent('ignorePagination', query.ignorePagination)

  const queryString = params.toString()
  return queryString ? `${API_ENDPOINTS.todos.base}?${queryString}` : API_ENDPOINTS.todos.base
}

const listTodos = (token: string, query?: TodoListQuery) => {
  const path = buildTodoListPath(query)
  const requestKey = `${token}:${path}`
  const cachedRequest = inFlightTodoListRequests.get(requestKey)
  if (cachedRequest) {
    return cachedRequest
  }

  const request = apiClient.get<TodoListResponse>(path, { token }).then(normalizeTodoListResponse)

  inFlightTodoListRequests.set(requestKey, request)

  void request.finally(() => {
    inFlightTodoListRequests.delete(requestKey)
  })

  return request
}

export const todoService = {
  create: (payload: TodoPayload, token: string) =>
    apiClient.post<TodoItem, TodoPayload>(API_ENDPOINTS.todos.base, payload, { token }),
  delete: (todoId: string, token: string) =>
    apiClient.delete<null>(API_ENDPOINTS.todos.byId(todoId), { token }),
  getOne: (todoId: string, token: string) => apiClient.get<TodoItem>(API_ENDPOINTS.todos.byId(todoId), { token }),
  list: listTodos,
  setStarred: (todoId: string, starred: boolean, token: string) =>
    apiClient.patch<TodoPatchResponse, Record<string, never>>(
      API_ENDPOINTS.todos.starred(todoId, starred),
      {},
      { token },
    ),
  setDone: (todoId: string, isDone: boolean, token: string) =>
    apiClient.patch<TodoPatchResponse, Record<string, never>>(API_ENDPOINTS.todos.done(todoId, isDone), {}, { token }),
  update: (todoId: string, payload: TodoPayload, token: string) =>
    apiClient.put<TodoItem, TodoPayload>(API_ENDPOINTS.todos.byId(todoId), payload, { token }),
}
