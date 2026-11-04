import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  isStaffTodoPriority,
  isStaffTodoStatus,
  staffTodoPriorityLabel,
  staffTodoStatusLabel,
} from '../staff-todo-labels'
import {
  viewerCanAccessTodo,
  viewerCanEditTodo,
  type StaffTodo,
} from '../staff-todos'

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

const sample: StaffTodo = {
  id: 't1',
  title: 'Follow up',
  description: '',
  priority: 'high',
  status: 'open',
  due_date: null,
  created_by: 'admin-1',
  assignee_id: 'staff-2',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

describe('staff todos helpers', () => {
  it('validates priority and status enums', () => {
    assert.equal(isStaffTodoPriority('urgent'), true)
    assert.equal(isStaffTodoPriority('critical'), false)
    assert.equal(isStaffTodoStatus('in_progress'), true)
    assert.equal(isStaffTodoStatus('blocked'), false)
    assert.equal(staffTodoPriorityLabel('high'), 'High')
    assert.equal(staffTodoStatusLabel('done'), 'Done')
  })

  it('scopes access to admin, creator, or assignee', () => {
    assert.equal(viewerCanAccessTodo(sample, { id: 'x', role: 'admin' }), true)
    assert.equal(viewerCanAccessTodo(sample, { id: 'admin-1', role: 'sales_closer' }), true)
    assert.equal(viewerCanAccessTodo(sample, { id: 'staff-2', role: 'sales_closer' }), true)
    assert.equal(viewerCanAccessTodo(sample, { id: 'other', role: 'sales_closer' }), false)
    assert.equal(viewerCanEditTodo(sample, { id: 'staff-2', role: 'sales_closer' }), true)
    assert.equal(viewerCanEditTodo(sample, { id: 'other', role: 'sales_closer' }), false)
  })

  it('wires nav, middleware, notifications, and migration', () => {
    const nav = source('src/lib/marketing-pipeline.ts')
    const middleware = source('src/middleware.ts')
    const lib = source('src/lib/staff-todos.ts')
    const migration = source('supabase-migration-051-staff-todos.sql')
    const page = source('src/app/admin/todos/page.tsx')
    const sidebar = source('src/components/admin/AdminSidebar.tsx')
    const bell = source('src/components/ui/NotificationBell.tsx')

    assert.match(nav, /href: '\/admin\/todos'/)
    assert.match(nav, /path === '\/admin\/todos'/)
    assert.match(middleware, /'\/admin\/todos'/)
    assert.match(lib, /createNotification/)
    assert.match(lib, /staffPortalEmailHtml/)
    assert.match(migration, /CREATE TABLE IF NOT EXISTS staff_todos/)
    assert.match(page, /Assign to/)
    assert.match(sidebar, /apiPath="\/api\/admin\/notifications"/)
    assert.match(bell, /apiPath/)
  })
})
