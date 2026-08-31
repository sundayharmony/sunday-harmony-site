'use client';

import { useEffect, useState } from 'react';
import DashboardTaskCard, { type DashboardTask } from '@/components/dashboard/DashboardTaskCard';

const STATUS_SECTIONS: Array<{
  status: DashboardTask['status']
  title: string
}> = [
  { status: 'in_progress', title: 'In Progress' },
  { status: 'in_review', title: 'In Review' },
  { status: 'not_started', title: 'Not Started' },
  { status: 'completed', title: 'Completed' },
]

export default function TasksPage() {
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const groupedTasks = {
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    in_review: tasks.filter(t => t.status === 'in_review'),
    not_started: tasks.filter(t => t.status === 'not_started'),
    completed: tasks.filter(t => t.status === 'completed'),
  };

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
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-brand-text mb-2">Tasks & Deliverables</h1>
        <p className="text-brand-muted">Track your Sunday Harmony project milestones.</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
          {error}
        </div>
      )}

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

      {totalCount === 0 ? (
        <div className="bg-white border border-brand-border rounded-2xl p-12 text-center">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-brand-muted">No tasks yet. Your Sunday Harmony team will add deliverables and milestones here.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {STATUS_SECTIONS.map(({ status, title }) => (
            groupedTasks[status].length > 0 ? (
              <div key={status}>
                <h2 className="text-xl font-serif text-brand-text mb-4">{title}</h2>
                <div className="grid gap-4">
                  {groupedTasks[status].map((task) => (
                    <DashboardTaskCard
                      key={task.id}
                      task={task}
                      onTaskUpdated={(updated) =>
                        setTasks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
                      }
                    />
                  ))}
                </div>
              </div>
            ) : null
          ))}
        </div>
      )}
    </div>
  );
}
