import { getSupabase, isSupabaseConfigured } from './supabase'
import { createNotification, getStaffUsers, getUserById, type User } from './db'
import {
  isEmailConfigured,
  sanitizeEmailSubjectPart,
  sendHtmlMailNonBlocking,
  staffPortalEmailHtml,
} from './smtp-mail'
import { isStaffRole } from './staff-roles'
import {
  isStaffTodoPriority,
  isStaffTodoStatus,
  staffTodoPriorityLabel,
  staffTodoStatusLabel,
  type StaffTodoPriority,
  type StaffTodoStatus,
} from './staff-todo-labels'

export type { StaffTodoPriority, StaffTodoStatus }
export {
  isStaffTodoPriority,
  isStaffTodoStatus,
  staffTodoPriorityLabel,
  staffTodoStatusLabel,
}

export interface StaffTodo {
  id: string
  title: string
  description: string
  priority: StaffTodoPriority
  status: StaffTodoStatus
  due_date: string | null
  created_by: string
  assignee_id: string | null
  created_at: string
  updated_at: string
}

export interface StaffTodoView extends StaffTodo {
  created_by_name: string
  created_by_email: string
  assignee_name: string | null
  assignee_email: string | null
}

export interface CreateStaffTodoInput {
  title: string
  description?: string
  priority?: StaffTodoPriority
  status?: StaffTodoStatus
  due_date?: string | null
  assignee_id?: string | null
  created_by: string
}

export interface UpdateStaffTodoInput {
  title?: string
  description?: string
  priority?: StaffTodoPriority
  status?: StaffTodoStatus
  due_date?: string | null
  assignee_id?: string | null
}

function normalizeDueDate(value: string | null | undefined): string | null {
  if (value == null || value === '') return null
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  return trimmed
}

async function staffNameMap(): Promise<Map<string, User>> {
  const users = await getStaffUsers()
  return new Map(users.map((user) => [user.id, user]))
}

function toView(todo: StaffTodo, users: Map<string, User>): StaffTodoView {
  const creator = users.get(todo.created_by)
  const assignee = todo.assignee_id ? users.get(todo.assignee_id) : undefined
  return {
    ...todo,
    created_by_name: creator?.name || 'Staff',
    created_by_email: creator?.email || '',
    assignee_name: assignee?.name || null,
    assignee_email: assignee?.email || null,
  }
}

export async function listStaffTodos(options?: {
  viewerId: string
  viewerRole?: string | null
  status?: StaffTodoStatus | 'all'
  assigneeId?: string | 'me' | 'unassigned' | 'all'
  limit?: number
}): Promise<StaffTodoView[]> {
  if (!isSupabaseConfigured()) return []

  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 200)
  let query = getSupabase()
    .from('staff_todos')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit)

  const isAdmin = options?.viewerRole === 'admin'
  if (!isAdmin && options?.viewerId) {
    query = query.or(`assignee_id.eq.${options.viewerId},created_by.eq.${options.viewerId}`)
  }

  if (options?.status && options.status !== 'all') {
    query = query.eq('status', options.status)
  }

  if (options?.assigneeId === 'me' && options.viewerId) {
    query = query.eq('assignee_id', options.viewerId)
  } else if (options?.assigneeId === 'unassigned') {
    query = query.is('assignee_id', null)
  } else if (options?.assigneeId && options.assigneeId !== 'all') {
    query = query.eq('assignee_id', options.assigneeId)
  }

  const { data, error } = await query
  if (error) {
    if (error.code !== '42P01') console.error('listStaffTodos error:', error)
    return []
  }

  const users = await staffNameMap()
  return ((data || []) as StaffTodo[]).map((todo) => toView(todo, users))
}

export async function getStaffTodo(id: string): Promise<StaffTodoView | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await getSupabase().from('staff_todos').select('*').eq('id', id).single()
  if (error || !data) return null
  const users = await staffNameMap()
  return toView(data as StaffTodo, users)
}

export function viewerCanAccessTodo(
  todo: StaffTodo,
  viewer: { id: string; role?: string | null }
): boolean {
  if (viewer.role === 'admin') return true
  return todo.created_by === viewer.id || todo.assignee_id === viewer.id
}

export function viewerCanEditTodo(
  todo: StaffTodo,
  viewer: { id: string; role?: string | null }
): boolean {
  if (viewer.role === 'admin') return true
  if (todo.created_by === viewer.id) return true
  // Assignees can update status/progress on their own items
  return todo.assignee_id === viewer.id
}

async function notifyAssignee(todo: StaffTodo, kind: 'assigned' | 'updated', actorName: string) {
  if (!todo.assignee_id) return

  const assignee = await getUserById(todo.assignee_id)
  if (!assignee || !isStaffRole(assignee.role)) return

  const priority = staffTodoPriorityLabel(todo.priority)
  const title =
    kind === 'assigned'
      ? `Todo assigned: ${todo.title}`
      : `Todo updated: ${todo.title}`
  const message =
    kind === 'assigned'
      ? `${actorName} assigned you a ${priority.toLowerCase()} priority todo.`
      : `${actorName} updated a todo assigned to you (${priority} · ${staffTodoStatusLabel(todo.status)}).`

  await createNotification({
    user_id: assignee.id,
    title,
    message,
    type: 'task',
    link: '/admin/todos',
  })

  if (isEmailConfigured() && assignee.email) {
    sendHtmlMailNonBlocking({
      to: assignee.email,
      subject: sanitizeEmailSubjectPart(title),
      html: staffPortalEmailHtml({
        heading: title,
        bodyParagraphs: [
          message,
          todo.description?.trim() ? todo.description.trim().slice(0, 400) : 'Open the Todos tab to review details.',
          todo.due_date ? `Due: ${todo.due_date}` : 'No due date set.',
        ],
        pathWithQuery: '/admin/todos',
        buttonLabel: 'Open Todos',
      }),
      logLabel: 'staff-todo',
    })
  }
}

export async function createStaffTodo(input: CreateStaffTodoInput): Promise<StaffTodoView | null> {
  if (!isSupabaseConfigured()) return null
  const title = input.title.trim()
  if (!title) return null

  const priority = isStaffTodoPriority(input.priority) ? input.priority : 'medium'
  const status = isStaffTodoStatus(input.status) ? input.status : 'open'
  const assigneeId = input.assignee_id?.trim() || null

  if (assigneeId) {
    const assignee = await getUserById(assigneeId)
    if (!assignee || !isStaffRole(assignee.role)) return null
  }

  const row = {
    title,
    description: (input.description || '').trim(),
    priority,
    status,
    due_date: normalizeDueDate(input.due_date),
    created_by: input.created_by,
    assignee_id: assigneeId,
  }

  const { data, error } = await getSupabase().from('staff_todos').insert(row).select().single()
  if (error || !data) {
    console.error('createStaffTodo error:', error)
    return null
  }

  const todo = data as StaffTodo
  const creator = await getUserById(input.created_by)
  if (todo.assignee_id && todo.assignee_id !== input.created_by) {
    await notifyAssignee(todo, 'assigned', creator?.name || 'Admin')
  }

  const users = await staffNameMap()
  return toView(todo, users)
}

export async function updateStaffTodo(
  id: string,
  updates: UpdateStaffTodoInput,
  actor: { id: string; name?: string | null }
): Promise<StaffTodoView | null> {
  if (!isSupabaseConfigured()) return null

  const existing = await getStaffTodo(id)
  if (!existing) return null

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof updates.title === 'string') {
    const title = updates.title.trim()
    if (!title) return null
    patch.title = title
  }
  if (typeof updates.description === 'string') patch.description = updates.description.trim()
  if (isStaffTodoPriority(updates.priority)) patch.priority = updates.priority
  if (isStaffTodoStatus(updates.status)) patch.status = updates.status
  if (updates.due_date !== undefined) patch.due_date = normalizeDueDate(updates.due_date)
  if (updates.assignee_id !== undefined) {
    const assigneeId = updates.assignee_id?.trim() || null
    if (assigneeId) {
      const assignee = await getUserById(assigneeId)
      if (!assignee || !isStaffRole(assignee.role)) return null
    }
    patch.assignee_id = assigneeId
  }

  const { data, error } = await getSupabase()
    .from('staff_todos')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    console.error('updateStaffTodo error:', error)
    return null
  }

  const todo = data as StaffTodo
  const actorName = actor.name || 'A teammate'
  const assigneeChanged =
    updates.assignee_id !== undefined && todo.assignee_id && todo.assignee_id !== existing.assignee_id
  if (assigneeChanged && todo.assignee_id !== actor.id) {
    await notifyAssignee(todo, 'assigned', actorName)
  } else if (todo.assignee_id && todo.assignee_id !== actor.id) {
    await notifyAssignee(todo, 'updated', actorName)
  }

  const users = await staffNameMap()
  return toView(todo, users)
}

export async function deleteStaffTodo(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { error } = await getSupabase().from('staff_todos').delete().eq('id', id)
  if (error) {
    console.error('deleteStaffTodo error:', error)
    return false
  }
  return true
}
