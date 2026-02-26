'use client'

import { useState, useEffect, useCallback } from 'react'
import { marketData, researchPhases } from '@/lib/toolkit-data'

export default function ResearchPage() {
  const [expandedPhase, setExpandedPhase] = useState<number | null>(1)
  const [tasksDone, setTasksDone] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/data').then(r => r.json()).then(d => {
      if (d.research_tasks && Object.keys(d.research_tasks).length > 0) setTasksDone(d.research_tasks)
    }).catch(() => {})
  }, [])

  const saveToDb = useCallback(async (updated: Record<string, boolean>) => {
    setSaving(true)
    await fetch('/api/admin/data', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ research_tasks: updated }),
    }).catch(() => {})
    setSaving(false)
  }, [])

  const toggleTask = (key: string) => {
    const updated = { ...tasksDone, [key]: !tasksDone[key] }
    setTasksDone(updated)
    saveToDb(updated)
  }

  const totalTasks = researchPhases.reduce((sum, p) => sum + p.tasks.length, 0)
  const doneTasks = Object.values(tasksDone).filter(Boolean).length
  const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  return (
    <div>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Market Research</h1>
          <p className="text-sm text-brand-muted">
            Industry data, target customer insights, and research tasks from your launch toolkit.
          </p>
        </div>
        {saving && <span className="text-xs text-brand-gold animate-pulse">Saving...</span>}
      </div>

      {/* Market Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {marketData.map((stat) => (
          <div
            key={stat.label}
            className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 text-center"
          >
            <div className="text-2xl font-extrabold text-brand-gold mb-1">{stat.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-brand-dim">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Overall Progress */}
      <div className="bg-[rgba(201,169,110,0.06)] border border-[rgba(201,169,110,0.15)] rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-brand-text">Research Progress</span>
          <span className="text-xs text-brand-gold font-semibold">{doneTasks}/{totalTasks} tasks ({progressPercent}%)</span>
        </div>
        <div className="w-full h-2 bg-[rgba(255,255,255,0.06)] rounded-full">
          <div
            className="h-2 rounded-full transition-all bg-brand-gold"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Research Phases */}
      <div className="space-y-3">
        {researchPhases.map((phase) => {
          const isOpen = expandedPhase === phase.id
          const phaseDone = phase.tasks.filter((_, i) => tasksDone[`${phase.id}-${i}`]).length
          const phaseTotal = phase.tasks.length

          return (
            <div
              key={phase.id}
              className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden"
            >
              {/* Phase Header */}
              <button
                onClick={() => setExpandedPhase(isOpen ? null : phase.id)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-[rgba(255,255,255,0.02)] transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{phase.icon}</span>
                  <div>
                    <div className="text-sm font-bold text-brand-text">
                      Phase {phase.id}: {phase.title}
                    </div>
                    <div className="text-[10px] text-brand-dim">{phase.timeframe}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold" style={{ color: phase.color }}>
                    {phaseDone}/{phaseTotal}
                  </span>
                  <div className="w-16 h-1.5 bg-[rgba(255,255,255,0.06)] rounded-full">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${phaseTotal > 0 ? (phaseDone / phaseTotal) * 100 : 0}%`, background: phase.color }}
                    />
                  </div>
                  <span className="text-brand-dim text-xs">{isOpen ? '▾' : '▸'}</span>
                </div>
              </button>

              {/* Phase Content */}
              {isOpen && (
                <div className="px-5 pb-5 border-t border-[rgba(255,255,255,0.04)]">
                  {/* Objective */}
                  <div className="mt-4 mb-4 p-3 rounded-lg" style={{ background: `${phase.color}0a`, border: `1px solid ${phase.color}20` }}>
                    <div className="text-[10px] font-bold uppercase mb-1" style={{ color: phase.color }}>Objective</div>
                    <p className="text-sm text-brand-muted">{phase.objective}</p>
                  </div>

                  {/* Key Findings */}
                  <div className="mb-4">
                    <div className="text-[10px] font-bold uppercase text-brand-dim mb-2">Key Findings</div>
                    <div className="space-y-2">
                      {phase.keyFindings.map((finding, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <span style={{ color: phase.color }} className="text-xs mt-0.5">◈</span>
                          <span className="text-xs text-brand-muted leading-relaxed">{finding}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Items */}
                  <div>
                    <div className="text-[10px] font-bold uppercase text-brand-dim mb-2">Action Items</div>
                    <div className="space-y-2">
                      {phase.tasks.map((task, i) => {
                        const key = `${phase.id}-${i}`
                        const done = tasksDone[key]
                        return (
                          <button
                            key={i}
                            onClick={() => toggleTask(key)}
                            className={`w-full text-left flex items-start gap-3 p-3 rounded-lg transition-all ${
                              done
                                ? 'bg-[rgba(74,158,125,0.06)] border border-[rgba(74,158,125,0.12)]'
                                : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.04)]'
                            }`}
                          >
                            <span className={`text-sm mt-0.5 ${done ? 'text-brand-green' : 'text-brand-dim'}`}>
                              {done ? '✓' : '○'}
                            </span>
                            <span className={`text-xs leading-relaxed ${done ? 'text-brand-muted line-through' : 'text-brand-text'}`}>
                              {task}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
