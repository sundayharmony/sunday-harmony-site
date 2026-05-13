'use client';

import { useEffect, useState } from 'react';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'not_started' | 'in_progress' | 'in_review' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string;
  category: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch tasks
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await fetch('/api/dashboard/tasks');
        if (!res.ok) throw new Error('Failed to fetch tasks');
        const result = await res.json();
        setTasks(Array.isArray(result) ? result : (result.data || []));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get status label
  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'not_started':
        return 'Not Started';
      case 'in_progress':
        return 'In Progress';
      case 'in_review':
        return 'In Review';
      case 'completed':
        return 'Completed';
      default:
        return status;
    }
  };

  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'not_started':
        return 'bg-gray-50 border-gray-200';
      case 'in_progress':
        return 'bg-blue-50 border-blue-200';
      case 'in_review':
        return 'bg-purple-50 border-purple-200';
      case 'completed':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  // Get priority color
  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'medium':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_review':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'not_started':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Group tasks by status
  const groupedTasks = {
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    in_review: tasks.filter(t => t.status === 'in_review'),
    not_started: tasks.filter(t => t.status === 'not_started'),
    completed: tasks.filter(t => t.status === 'completed'),
  };

  // Calculate progress
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const totalCount = tasks.length;
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-brand-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-brand-text mb-2">Tasks & Deliverables</h1>
        <p className="text-brand-muted">Track your Sunday Harmony project milestones.</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Progress Summary */}
      {totalCount > 0 && (
        <div className="mb-8 bg-white border border-brand-border rounded-2xl p-6">
          <p className="text-brand-text font-medium mb-3">
            {completedCount} of {totalCount} tasks completed
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-brand-text h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-brand-muted text-sm mt-3">{progressPercent}% complete</p>
        </div>
      )}

      {/* Tasks Section */}
      {totalCount === 0 ? (
        <div className="bg-white border border-brand-border rounded-2xl p-12 text-center">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-brand-muted">No tasks yet. Your Sunday Harmony team will add deliverables and milestones here.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* In Progress */}
          {groupedTasks.in_progress.length > 0 && (
            <div>
              <h2 className="text-xl font-serif text-brand-text mb-4">In Progress</h2>
              <div className="grid gap-4">
                {groupedTasks.in_progress.map((task) => (
                  <div
                    key={task.id}
                    className={`border border-brand-border rounded-2xl p-6 ${getStatusColor(task.status)}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-brand-text font-serif text-lg flex-1">{task.title}</h3>
                      <span className={`ml-4 px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadgeColor(task.status)}`}>
                        {getStatusLabel(task.status)}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-brand-muted text-sm mb-4 line-clamp-2">{task.description}</p>
                    )}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
                        </span>
                        <span className="px-3 py-1 bg-accent-soft text-accent border border-accent/20 rounded-full text-xs font-medium">
                          {task.category}
                        </span>
                      </div>
                      {task.due_date && (
                        <p className="text-brand-muted text-sm">Due: {formatDate(task.due_date)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* In Review */}
          {groupedTasks.in_review.length > 0 && (
            <div>
              <h2 className="text-xl font-serif text-brand-text mb-4">In Review</h2>
              <div className="grid gap-4">
                {groupedTasks.in_review.map((task) => (
                  <div
                    key={task.id}
                    className={`border border-brand-border rounded-2xl p-6 ${getStatusColor(task.status)}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-brand-text font-serif text-lg flex-1">{task.title}</h3>
                      <span className={`ml-4 px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadgeColor(task.status)}`}>
                        {getStatusLabel(task.status)}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-brand-muted text-sm mb-4 line-clamp-2">{task.description}</p>
                    )}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
                        </span>
                        <span className="px-3 py-1 bg-accent-soft text-accent border border-accent/20 rounded-full text-xs font-medium">
                          {task.category}
                        </span>
                      </div>
                      {task.due_date && (
                        <p className="text-brand-muted text-sm">Due: {formatDate(task.due_date)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Not Started */}
          {groupedTasks.not_started.length > 0 && (
            <div>
              <h2 className="text-xl font-serif text-brand-text mb-4">Not Started</h2>
              <div className="grid gap-4">
                {groupedTasks.not_started.map((task) => (
                  <div
                    key={task.id}
                    className={`border border-brand-border rounded-2xl p-6 ${getStatusColor(task.status)}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-brand-text font-serif text-lg flex-1">{task.title}</h3>
                      <span className={`ml-4 px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadgeColor(task.status)}`}>
                        {getStatusLabel(task.status)}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-brand-muted text-sm mb-4 line-clamp-2">{task.description}</p>
                    )}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
                        </span>
                        <span className="px-3 py-1 bg-accent-soft text-accent border border-accent/20 rounded-full text-xs font-medium">
                          {task.category}
                        </span>
                      </div>
                      {task.due_date && (
                        <p className="text-brand-muted text-sm">Due: {formatDate(task.due_date)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {groupedTasks.completed.length > 0 && (
            <div>
              <h2 className="text-xl font-serif text-brand-text mb-4">Completed</h2>
              <div className="grid gap-4">
                {groupedTasks.completed.map((task) => (
                  <div
                    key={task.id}
                    className={`border border-brand-border rounded-2xl p-6 ${getStatusColor(task.status)}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-brand-text font-serif text-lg flex-1 line-through opacity-60">
                        {task.title}
                      </h3>
                      <span className={`ml-4 px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadgeColor(task.status)}`}>
                        {getStatusLabel(task.status)}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-brand-muted text-sm mb-4 line-clamp-2 opacity-60">{task.description}</p>
                    )}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
                        </span>
                        <span className="px-3 py-1 bg-accent-soft text-accent border border-accent/20 rounded-full text-xs font-medium">
                          {task.category}
                        </span>
                      </div>
                      {task.due_date && (
                        <p className="text-brand-muted text-sm">Due: {formatDate(task.due_date)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
