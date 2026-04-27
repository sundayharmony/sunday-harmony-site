'use client'

import { useState, useEffect } from 'react'
import StatusBadge from '@/components/ui/StatusBadge'

interface Client {
  id: string
  name: string
  business: string
}

interface Task {
  id: string
  client_id: string
  title: string
  description?: string
  status: 'not_started' | 'in_progress' | 'in_review' | 'completed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date?: string
  category: string
  created_at: string
}

const statusColors: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  in_review: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
}

const priorityColors: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

export default function AdminTasksPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'not_started' as const,
    priority: 'medium' as const,
    due_date: '',
    category: 'deliverable',
  })

  // Fetch clients on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/clients')
        if (!res.ok) throw new Error('Failed to load clients')
        const data = await res.json()
        setClients(data)
        setError('')
      } catch (err) {
        console.error('Failed to load clients:', err)
        setError('Failed to load clients')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    const clientParam = new URLSearchParams(window.location.search).get('client')
    if (clientParam) setSelectedClientId(prev => prev || clientParam)
  }, [])

  // Fetch tasks when client is selected
  useEffect(() => {
    if (!selectedClientId) {
      setTasks([])
      return
    }

    (async () => {
      try {
        const res = await fetch(`/api/admin/tasks?client_id=${selectedClientId}`)
        if (!res.ok) throw new Error('Failed to load tasks')
        const data = await res.json()
        setTasks(data)
        setError('')
      } catch (err) {
        console.error('Failed to load tasks:', err)
        setError('Failed to load tasks')
      }
    })()
  }, [selectedClientId])

  const addTask = async () => {
    if (!selectedClientId || !form.title.trim()) {
      setError('Client and task title are required')
      return
    }

    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClientId,
          ...form,
        }),
      })
      if (!res.ok) throw new Error('Failed to create task')
      const newTask = await res.json()
      setTasks(prev => [...prev, newTask])
      setForm({
        title: '',
        description: '',
        status: 'not_started',
        priority: 'medium',
        due_date: '',
        category: 'deliverable',
      })
      setShowForm(false)
      setError('')
    } catch (err) {
      setError('Failed to create task')
      console.error(err)
    }
  }

  const updateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to update task')
      const updated = await res.json()
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t))
      setError('')
    } catch (err) {
      setError('Failed to update task')
      console.error(err)
    }
  }

  const deleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return

    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId }),
      })
      if (!res.ok) throw new Error('Failed to delete task')
      setTasks(prev => prev.filter(t => t.id !== taskId))
      setError('')
    } catch (err) {
      setError('Failed to delete task')
      console.error(err)
    }
  }

  const selectedClient = clients.find(c => c.id === selectedClientId)

  // Summary stats
  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    pending: tasks.filter(t => t.status === 'not_started').length,
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Tasks</h1>
          <p className="text-sm text-brand-muted">Manage client tasks and deliverables</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2.5 rounded-lg bg-brand-gold text-white text-sm font-bold hover:-translate-y-0.5 transition-all"
        >
          + Add Task
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Client Selector */}
      <div className="mb-6">
        <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-2">
          Select Client
        </label>
        <select
          value={selectedClientId || ''}
          onChange={e => setSelectedClientId(e.target.value || null)}
          className="w-full md:w-64 py-2.5 px-4 bg-[#fafaf8] border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-brand-gold"
        >
          <option value="">Choose a client...</option>
          {clients.map(client => (
            <option key={client.id} value={client.id}>
              {client.name} ({client.business})
            </option>
          ))}
        </select>
      </div>

      {/* Summary Stats */}
      {selectedClientId && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-brand-border rounded-lg p-4">
            <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">Total</div>
            <div className="text-2xl font-bold text-brand-text">{stats.total}</div>
          </div>
          <div className="bg-white border border-brand-border rounded-lg p-4">
            <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">Completed</div>
            <div className="text-2xl font-bold text-brand-green">{stats.completed}</div>
          </div>
          <div className="bg-white border border-brand-border rounded-lg p-4">
            <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">In Progress</div>
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
          </div>
          <div className="bg-white border border-brand-border rounded-lg p-4">
            <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">Pending</div>
            <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
          </div>
        </div>
      )}

      {/* Add Task Form */}
      {showForm && selectedClientId && (
        <div className="bg-[rgba(184,148,63,0.05)] border border-[rgba(184,148,63,0.2)] rounded-xl p-6 mb-6">
          <h3 className="text-sm font-bold text-brand-gold mb-4">New Task for {selectedClient?.name}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">
                Title *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Task title"
                className="w-full py-2 px-3 bg-[#fafaf8] border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-brand-gold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">
                Priority
              </label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value as any }))}
                className="w-full py-2 px-3 bg-[#fafaf8] border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-brand-gold"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">
                Status
              </label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                className="w-full py-2 px-3 bg-[#fafaf8] border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-brand-gold"
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full py-2 px-3 bg-[#fafaf8] border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-brand-gold"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">
              Category
            </label>
            <input
              type="text"
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              placeholder="e.g., deliverable, design, development"
              className="w-full py-2 px-3 bg-[#fafaf8] border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-brand-gold"
            />
          </div>
          <div className="mb-4">
            <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Task description..."
              rows={3}
              className="w-full py-2 px-3 bg-[#fafaf8] border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-brand-gold resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={addTask}
              className="px-4 py-2 rounded-lg bg-brand-gold text-white text-xs font-bold hover:bg-opacity-90 transition-all"
            >
              Create Task
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-brand-dim text-xs font-semibold hover:text-brand-text transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tasks List */}
      {selectedClientId ? (
        <div className="bg-white border border-brand-border rounded-xl overflow-hidden shadow-sm">
          {tasks.length === 0 ? (
            <div className="p-8 text-center text-brand-dim text-sm">
              No tasks for this client yet. Create one above.
            </div>
          ) : (
            <div className="divide-y divide-brand-border">
              {tasks.map(task => (
                <div key={task.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-brand-text mb-1">{task.title}</h3>
                      {task.description && (
                        <p className="text-xs text-brand-muted mb-2">{task.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${statusColors[task.status]}`}>
                          {task.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${priorityColors[task.priority]}`}>
                          {task.priority.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-brand-dim bg-gray-100 px-2 py-1 rounded-full">
                          {task.category}
                        </span>
                        {task.due_date && (
                          <span className="text-[10px] text-brand-dim">
                            Due: {new Date(task.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={task.status}
                        onChange={e => updateTaskStatus(task.id, e.target.value as Task['status'])}
                        className="py-1.5 px-2 bg-[#fafaf8] border border-brand-border rounded-lg text-brand-text text-xs outline-none focus:border-brand-gold"
                      >
                        <option value="not_started">Not Started</option>
                        <option value="in_progress">In Progress</option>
                        <option value="in_review">In Review</option>
                        <option value="completed">Completed</option>
                      </select>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-brand-dim">
          <p className="text-sm">Select a client above to view and manage their tasks</p>
        </div>
      )}
    </div>
  )
}
