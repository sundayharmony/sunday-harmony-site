'use client'

import { useState } from 'react'
import { roadmapWeeks } from '@/lib/toolkit-data'

export default function RoadmapPage() {
  const [tasks, setTasks] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState(0)

  const toggle = (id: string) => setTasks(p => ({ ...p, [id]: !p[id] }))
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
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">90-Day Roadmap</h1>
        <p className="text-sm text-brand-muted">Your week-by-week launch plan from foundation to scale.</p>
      </div>

      {/* Overall Progress */}
      <div className="bg-[rgba(201,169,110,0.06)] border border-[rgba(201,169,110,0.15)] rounded-xl p-5 mb-6 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-brand-gold">Overall Progress</div>
          <div className="text-xs text-brand-muted">{totalDone} of {totalTasks} tasks completed</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-40 h-2 bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-brand-gold to-brand-gold-light rounded-full transition-all duration-500" style={{ width: `${totalPct}%` }} />
          </div>
          <span className="text-sm font-bold text-brand-gold">{totalPct}%</span>
        </div>
      </div>

      {/* Phases */}
      {roadmapWeeks.map((week, wi) => {
        const isOpen = expanded === wi
        const pct = phaseProgress(wi)
        return (
          <div key={wi} className={`bg-[rgba(255,255,255,${isOpen ? '0.04' : '0.02'})] border border-[rgba(255,255,255,${isOpen ? '0.08' : '0.06'})] rounded-xl mb-3 overflow-hidden transition-all`}>
            <div onClick={() => setExpanded(isOpen ? -1 : wi)} className="p-5 cursor-pointer flex items-center gap-4">
              <div className="w-2 h-10 rounded-full" style={{ background: week.color }} />
              <div className="flex-1">
                <div className="text-[10px] font-bold tracking-[0.1em] uppercase" style={{ color: week.color }}>{week.week}</div>
                <div className="text-base font-bold text-brand-text">{week.title}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: `conic-gradient(${week.color} ${pct * 3.6}deg, rgba(255,255,255,0.06) 0deg)` }}>
                  <div className="w-8 h-8 rounded-full bg-[#0e0e14] flex items-center justify-center" style={{ color: pct === 100 ? week.color : '#6a6a7a' }}>{pct}%</div>
                </div>
                <span className={`text-brand-dim transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
              </div>
            </div>
            {isOpen && (
              <div className="px-5 pb-5 border-t border-[rgba(255,255,255,0.04)]">
                {/* Tasks */}
                <div className="mt-4 space-y-2">
                  {week.tasks.map((task, ti) => {
                    const id = `${wi}-${ti}`
                    const done = tasks[id]
                    return (
                      <div key={ti} onClick={() => toggle(id)}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${done ? 'bg-[rgba(201,169,110,0.04)]' : 'bg-[rgba(255,255,255,0.02)]'} border border-[rgba(255,255,255,0.04)]`}>
                        <div className={`w-5 h-5 rounded flex-shrink-0 mt-0.5 flex items-center justify-center border-2 ${done ? 'bg-brand-gold border-brand-gold' : 'border-[rgba(255,255,255,0.15)]'}`}>
                          {done && <span className="text-[#0a0a0f] text-xs font-bold">✓</span>}
                        </div>
                        <span className={`text-sm ${done ? 'text-[#8a8a7a] line-through' : 'text-[#c0c0ca]'}`}>{task}</span>
                      </div>
                    )
                  })}
                </div>
                {/* Milestone & KPIs */}
                <div className="mt-4 p-4 rounded-lg bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.1)]">
                  <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-gold mb-2">Milestone</div>
                  <p className="text-sm text-brand-muted mb-3">{week.milestone}</p>
                  <div className="flex gap-2 flex-wrap">
                    {week.kpis.map((kpi, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-[rgba(201,169,110,0.1)] text-brand-gold border border-[rgba(201,169,110,0.15)]">{kpi}</span>
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
