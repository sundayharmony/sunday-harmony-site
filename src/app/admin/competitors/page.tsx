'use client'

import { useState } from 'react'
import { competitors, vulnerabilities } from '@/lib/toolkit-data'

const threatColor = { high: 'text-brand-red', medium: 'text-brand-gold', low: 'text-brand-green' }
const threatBg = { high: 'bg-[rgba(212,86,78,0.15)]', medium: 'bg-[rgba(201,169,110,0.15)]', low: 'bg-[rgba(74,158,125,0.15)]' }
const priorityColor = { critical: 'text-brand-red', high: 'text-brand-gold', medium: 'text-brand-blue' }

export default function CompetitorsPage() {
  const [tab, setTab] = useState<'landscape' | 'gaps'>('landscape')
  const [selected, setSelected] = useState(0)

  const c = competitors[selected]

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Competitive Analysis</h1>
        <p className="text-sm text-brand-muted">Map the NJ landscape and find your positioning advantage.</p>
      </div>

      <div className="flex gap-2 mb-6">
        {[['landscape', 'Competitors'], ['gaps', 'Market Gaps']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as typeof tab)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${tab === key ? 'bg-[rgba(201,169,110,0.12)] border border-[rgba(201,169,110,0.3)] text-brand-gold' : 'bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] text-brand-muted'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'landscape' && (
        <div className="grid grid-cols-[200px_1fr] gap-6">
          {/* Competitor List */}
          <div className="space-y-2">
            {competitors.map((comp, i) => (
              <button key={i} onClick={() => setSelected(i)}
                className={`w-full text-left p-3 rounded-lg transition-all ${selected === i
                  ? 'bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.2)]'
                  : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.04)]'}`}>
                <div className="text-sm font-semibold text-brand-text">{comp.name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold uppercase ${threatColor[comp.threat]}`}>{comp.threat}</span>
                  <span className="text-[10px] text-brand-dim">{comp.price}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Detail */}
          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-brand-text">{c.name}</h2>
                <span className="text-xs text-brand-dim">{c.type}</span>
              </div>
              <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${threatBg[c.threat]} ${threatColor[c.threat]}`}>{c.threat} threat</span>
            </div>

            <div className="flex gap-6 mb-4">
              {[['Price', c.price], ['Founded', c.founded], ['Team', c.team]].map(([l, v]) => (
                <div key={l as string}>
                  <div className="text-[10px] font-bold uppercase text-brand-dim">{l}</div>
                  <div className="text-sm text-brand-text">{v}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5 mb-5">
              {c.services.map(s => (
                <span key={s} className="px-2.5 py-0.5 rounded-full text-[10px] bg-[rgba(201,169,110,0.1)] text-brand-gold border border-[rgba(201,169,110,0.15)]">{s}</span>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="bg-[rgba(74,158,125,0.04)] border border-[rgba(74,158,125,0.1)] rounded-lg p-4">
                <div className="text-[10px] font-bold uppercase text-brand-green mb-2">Strengths</div>
                {c.strengths.map((s, i) => (
                  <div key={i} className="flex gap-2 mb-1.5 text-xs text-brand-muted"><span className="text-brand-green">+</span>{s}</div>
                ))}
              </div>
              <div className="bg-[rgba(212,86,78,0.04)] border border-[rgba(212,86,78,0.1)] rounded-lg p-4">
                <div className="text-[10px] font-bold uppercase text-brand-red mb-2">Weaknesses</div>
                {c.weaknesses.map((w, i) => (
                  <div key={i} className="flex gap-2 mb-1.5 text-xs text-brand-muted"><span className="text-brand-red">−</span>{w}</div>
                ))}
              </div>
            </div>

            <div className="bg-[rgba(201,169,110,0.06)] border border-[rgba(201,169,110,0.12)] rounded-lg p-4">
              <div className="text-[10px] font-bold uppercase text-brand-gold mb-2">Your Angle Against {c.name}</div>
              <p className="text-sm text-brand-muted leading-relaxed">{c.angle}</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'gaps' && (
        <div className="space-y-3">
          {vulnerabilities.map((v, i) => (
            <div key={i} className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-base font-bold text-brand-text">{v.gap}</h3>
                <span className={`text-[10px] font-bold uppercase ${priorityColor[v.priority]}`}>{v.priority}</span>
              </div>
              <div className="text-xs text-brand-dim mb-2">{v.stat}</div>
              <div className="p-3 rounded-lg bg-[rgba(74,158,125,0.04)] border border-[rgba(74,158,125,0.1)]">
                <div className="text-[10px] font-bold uppercase text-brand-green mb-1">Your Opportunity</div>
                <p className="text-sm text-brand-muted">{v.opportunity}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
