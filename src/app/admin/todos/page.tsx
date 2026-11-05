'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  staffTodoPriorityLabel,
  staffTodoStatusLabel,
  type StaffTodoPriority,
  type StaffTodoStatus,
} from '@/lib/staff-todo-labels'

type StaffTodoView = {
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
  created_by_name: string
  created_by_email: string
  assignee_name: string | null
  assignee_email: string | null
}

type AssigneeOption = { id: string; name: string; email: string; role: string }

const PRIORITIES: StaffTodoPriority[] = ['urgent', 'high', 'medium', 'low']
const STATUSES: StaffTodoStatus[] = ['open', 'in_progress', 'done', 'cancelled']

const priorityClass: Record<StaffTodoPriority, string> = {
  urgent: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-gray-100 text-gray-700',
}

const statusClass: Record<StaffTodoStatus, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-accent-soft text-brand-text',
  done: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-500',
}

const emptyForm = {
  title: '',
  description: '',
  priority: 'medium' as StaffTodoPriority,
  due_date: '',
  assignee_id: '',
}

function AdminTodosBoard() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const focusTodoId = searchParams.get('todo')
  const isAdmin = session?.user?.role === 'admin'
  const [todos, setTodos] = useState<StaffTodoView[]>([])
  const [assignees, setAssignees] = useState<AssigneeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState(focusTodoId ? 'all' : 'open')
  const [assigneeFilter, setAssigneeFilter] = useState(isAdmin ? 'all' : 'me')
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    if (!isAdmin && assigneeFilter === 'all') setAssigneeFilter('me')
  }, [isAdmin, assigneeFilter])

  useEffect(() => {
    if (focusTodoId && statusFilter !== 'all') setStatusFilter('all')
  }, [focusTodoId, statusFilter])

  useEffect(() => {
    if (!focusTodoId || loading) return
    const node = document.getElementById(`staff-todo-${focusTodoId}`)
    node?.scrollIntoView({ block: 'center' })
  }, [focusTodoId, loading, todos])

  async function loadTodos() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        assignee: assigneeFilter,
      })
      const res = await fetch(`/api/admin/todos?${params}`)
      if (!res.ok) throw new Error('Failed to load todos')
      const data = await res.json()
      setTodos(Array.isArray(data.todos) ? data.todos : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load todos')
    } finally {
      setLoading(false)
    }
  }

  async function loadAssignees() {
    try {
      const res = await fetch('/api/admin/todos?view=assignees')
      if (!res.ok) return
      const data = await res.json()
      setAssignees(Array.isArray(data.assignees) ? data.assignees : [])
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void loadAssignees()
  }, [])

  useEffect(() => {
    void loadTodos()
  }, [statusFilter, assigneeFilter])

  const openCount = useMemo(
    () => todos.filter((todo) => todo.status === 'open' || todo.status === 'in_progress').length,
    [todos]
  )

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('Title is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          priority: form.priority,
          due_date: form.due_date || null,
          assignee_id: form.assignee_id || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to create todo')
      setForm(emptyForm)
      setShowForm(false)
      await loadTodos()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create todo')
    } finally {
      setSaving(false)
    }
  }

  async function patchTodo(id: string, patch: Record<string, unknown>) {
    setError('')
    const res = await fetch(`/api/admin/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Failed to update todo')
      return
    }
    setTodos((prev) => prev.map((todo) => (todo.id === id ? data.todo : todo)))
  }

  async function removeTodo(id: string) {
    if (!window.confirm('Delete this todo?')) return
    const res = await fetch(`/api/admin/todos/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Failed to delete todo')
      return
    }
    setTodos((prev) => prev.filter((todo) => todo.id !== id))
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-1">Todos</h1>
          <p className="text-sm text-brand-muted">
            Assign work with priority. Assignees get an in-app notification and email.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2.5 rounded-lg bg-brand-text text-white text-sm font-bold hover:bg-neutral-800 transition-colors"
        >
          {showForm ? 'Cancel' : '+ New todo'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-2xl border border-brand-border bg-white p-5 space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-brand-dim uppercase tracking-wide mb-1">
              Title
            </label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm"
              placeholder="What needs to get done?"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-brand-dim uppercase tracking-wide mb-1">
              Details
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm min-h-[80px]"
              placeholder="Optional context for the assignee"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-brand-dim uppercase tracking-wide mb-1">
                Priority
              </label>
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priority: e.target.value as StaffTodoPriority }))
                }
                className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {staffTodoPriorityLabel(p)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-dim uppercase tracking-wide mb-1">
                Due date
              </label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-dim uppercase tracking-wide mb-1">
                Assign to
              </label>
              <select
                value={form.assignee_id}
                onChange={(e) => setForm((f) => ({ ...f, assignee_id: e.target.value }))}
                className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm"
              >
                <option value="">{isAdmin ? 'Unassigned' : 'Assign to me'}</option>
                {assignees.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} ({person.role.replace(/_/g, ' ')})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2.5 rounded-lg bg-brand-text text-white text-sm font-bold disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Create & notify'}
          </button>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-brand-border px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="rounded-lg border border-brand-border px-3 py-2 text-sm"
        >
          {isAdmin && <option value="all">Everyone</option>}
          <option value="me">Assigned to me</option>
          {isAdmin && <option value="unassigned">Unassigned</option>}
          {isAdmin &&
            assignees.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
        </select>
        <span className="text-xs text-brand-dim ml-auto">
          {loading ? 'Loading…' : `${todos.length} shown · ${openCount} active in view`}
        </span>
      </div>

      <div className="space-y-3">
        {!loading && todos.length === 0 && (
          <div className="rounded-2xl border border-brand-border bg-white p-8 text-center text-sm text-brand-muted">
            No todos match these filters.
          </div>
        )}
        {todos.map((todo) => (
          <div
            key={todo.id}
            id={`staff-todo-${todo.id}`}
            className={`rounded-2xl border bg-white p-4 sm:p-5 ${
              todo.id === focusTodoId ? 'border-accent ring-2 ring-accent/30' : 'border-brand-border'
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h2 className="font-bold text-brand-text">{todo.title}</h2>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${priorityClass[todo.priority]}`}>
                    {staffTodoPriorityLabel(todo.priority)}
                  </span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusClass[todo.status]}`}>
                    {staffTodoStatusLabel(todo.status)}
                  </span>
                </div>
                {todo.description && (
                  <p className="text-sm text-brand-muted whitespace-pre-wrap mb-2">{todo.description}</p>
                )}
                <div className="text-xs text-brand-dim space-y-0.5">
                  <div>
                    Assignee:{' '}
                    <span className="text-brand-text font-medium">
                      {todo.assignee_name || 'Unassigned'}
                    </span>
                  </div>
                  <div>
                    Created by {todo.created_by_name}
                    {todo.due_date ? ` · Due ${todo.due_date}` : ''}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
                <select
                  value={todo.status}
                  onChange={(e) => patchTodo(todo.id, { status: e.target.value })}
                  className="rounded-lg border border-brand-border px-2 py-1.5 text-xs"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {staffTodoStatusLabel(s)}
                    </option>
                  ))}
                </select>
                <select
                  value={todo.priority}
                  onChange={(e) => patchTodo(todo.id, { priority: e.target.value })}
                  className="rounded-lg border border-brand-border px-2 py-1.5 text-xs"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {staffTodoPriorityLabel(p)}
                    </option>
                  ))}
                </select>
                {isAdmin && (
                  <select
                    value={todo.assignee_id || ''}
                    onChange={(e) =>
                      patchTodo(todo.id, { assignee_id: e.target.value || null })
                    }
                    className="rounded-lg border border-brand-border px-2 py-1.5 text-xs"
                  >
                    <option value="">Unassigned</option>
                    {assignees.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                )}
                {(isAdmin || todo.created_by === session?.user?.id) && (
                  <button
                    type="button"
                    onClick={() => removeTodo(todo.id)}
                    className="text-xs font-semibold text-red-600 hover:underline px-2 py-1.5"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminTodosPage() {
  return (
    <Suspense fallback={<p className="text-sm text-brand-muted">Loading todos…</p>}>
      <AdminTodosBoard />
    </Suspense>
  )
}
