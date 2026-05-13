'use client'

import { useState, useEffect, useCallback } from 'react'
import { roadmapWeeks } from '@/lib/toolkit-data'

export default function RoadmapPage() {
  const [tasks, setTasks] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/data').then(r => r.json()).then(d => {
      if (d.roadmap_tasks && Object.keys(d.roadmap_tasks).length > 0) setTasks(d.roadmap_tasks)
    }).catch(() => {})
  }, [])

  const saveToDb = useCallback(async (updated: Record<string, boolean>) => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/data', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roadmap_tasks: updated }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setError('')
    } catch (err) {
      setError('Failed to save. Please try again.')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }, [])

  const toggle = (id: string) => {
    const updated = { ...tasks, [id]: !tasks[id] }
    setTasks(updated)
    saveToDb(updated)
  }
  const phaseProgress = (weekIdx: number) => {
    const week = roadmapWeeks[weekIdx]
    const done = week.tasks.filter((_, i) => tasks[`${weekIdx}-${i}`]).length
    return Math.round((done / week.tasks.length) * 100)
  }
  const totalDone = Object.values(tasks).filter(Boolean).length
  const totalTasks = roadmapWeeks.reduce((s, w) => s + w.tasks.length, 0)
  const totalPct = Math.round((totalDone / totalTasks) * 100)

  return (
    <div>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">90-Day Roadmap</h1>
          <p className="text-sm text-brand-muted">Your week-by-week launch plan from foundation to scale.</p>
        </div>
        <div className="flex items-center gap-3">
          {error ? (
            <span className="text-xs text-red-600">Error saving</span>
          ) : saving ? (
            <span className="text-xs text-accent animate-pulse">Saving...</span>
          ) : null}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Overall Progress */}
      <div className="bg-accent-soft border border-accent rounded-xl p-5 mb-6 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-accent">Overall Progress</div>
          <div className="text-xs text-brand-muted">{totalDone} of {totalTasks} tasks completed</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-40 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-neutral-300 to-brand-text rounded-full transition-all duration-500" style={{ width: `${totalPct}%` }} />
          </div>
          <span className="text-sm font-bold text-accent">{totalPct}%</span>
        </div>
      </div>

      {/* Phases */}
      {roadmapWeeks.map((week, wi) => {
        const isOpen = expanded === wi
        const pct = phaseProgress(wi)
        return (
          <div key={wi} className={`${isOpen ? 'bg-white shadow-sm' : 'bg-gray-50'} border border-brand-border rounded-xl mb-3 overflow-hidden transition-all`}>
            <div onClick={() => setExpanded(isOpen ? -1 : wi)} className="p-5 cursor-pointer flex items-center gap-4">
              <div className="w-2 h-10 rounded-full" style={{ background: week.color }} />
              <div className="flex-1">
                <div className="text-[10px] font-bold tracking-[0.1em] uppercase" style={{ color: week.color }}>{week.week}</div>
                <div className="text-base font-bold text-brand-text">{week.title}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: `conic-gradient(${week.color} ${pct * 3.6}deg, #e5e7eb 0deg)` }}>
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center" style={{ color: pct === 100 ? week.color : '#999' }}>{pct}%</div>
                </div>
                <span className={`text-brand-dim transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
              </div>
            </div>
            {isOpen && (
              <div className="px-5 pb-5 border-t border-brand-border">
                {/* Tasks */}
                <div className="mt-4 space-y-2">
                  {week.tasks.map((task, ti) => {
                    const id = `${wi}-${ti}`
                    const done = tasks[id]
                    return (
                      <div key={ti} onClick={() => toggle(id)}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${done ? 'bg-accent-soft' : 'bg-gray-50'} border border-gray-200`}>
                        <div className={`w-5 h-5 rounded flex-shrink-0 mt-0.5 flex items-center justify-center border-2 ${done ? 'bg-brand-text border-accent' : 'border-gray-300'}`}>
                          {done && <span className="text-white text-xs font-bold">✓</span>}
                        </div>
                        <span className={`text-sm ${done ? 'text-brand-muted line-through' : 'text-brand-text'}`}>{task}</span>
                      </div>
                    )
                  })}
                </div>
                {/* Milestone & KPIs */}
                <div className="mt-4 p-4 rounded-lg bg-accent-soft border border-brand-border">
                  <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-accent mb-2">Milestone</div>
                  <p className="text-sm text-brand-muted mb-3">{week.milestone}</p>
                  <div className="flex gap-2 flex-wrap">
                    {week.kpis.map((kpi, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-accent-soft text-accent border border-accent">{kpi}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
