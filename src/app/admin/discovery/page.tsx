'use client'

import { useState } from 'react'
import { interviewScript, prospectList } from '@/lib/toolkit-data'

export default function DiscoveryPage() {
  const [tab, setTab] = useState<'script' | 'prospects'>('script')
  const [expandedQ, setExpandedQ] = useState<string | null>(null)

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Customer Discovery</h1>
        <p className="text-sm text-brand-muted">Interview scripts and prospect targeting for NJ small businesses.</p>
      </div>

      <div className="flex gap-2 mb-6">
        {[['script', 'Interview Script'], ['prospects', 'Prospect Finder']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as typeof tab)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${tab === key ? 'bg-accent-soft border border-accent text-accent' : 'bg-gray-50 border border-brand-border text-brand-muted'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'script' && (
        <div>
          <div className="bg-accent-soft border border-accent rounded-xl p-4 mb-5">
            <div className="text-sm font-bold text-accent mb-1">20-Minute Conversation Guide</div>
            <p className="text-xs text-brand-muted">Click any question for coaching notes on why to ask it and what to listen for.</p>
          </div>
          {interviewScript.map((sec, si) => (
            <div key={si} className="mb-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-1 h-6 rounded" style={{ background: sec.color }} />
                <span className="text-sm font-bold text-brand-text">{sec.section}</span>
                <span className="text-[10px] text-brand-dim">~{sec.time}</span>
              </div>
              {sec.questions.map((item, qi) => {
                const key = `${si}-${qi}`
                const isOpen = expandedQ === key
                return (
                  <div key={qi} className={`ml-4 mb-2 rounded-lg border transition-all ${isOpen ? 'bg-gray-50 border-accent' : 'bg-white border-brand-border'}`}>
                    <div onClick={() => setExpandedQ(isOpen ? null : key)} className="p-3 cursor-pointer flex items-start gap-2">
                      <span style={{ color: sec.color }} className="text-sm font-bold mt-0.5">Q</span>
                      <p className="flex-1 text-sm text-brand-text italic leading-relaxed">&ldquo;{item.q}&rdquo;</p>
                      <span className={`text-brand-dim text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                    </div>
                    {isOpen && (
                      <div className="px-3 pb-3 border-t border-gray-200">
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div className="bg-accent-soft rounded-lg p-3 border border-accent">
                            <div className="text-[10px] font-bold uppercase text-accent mb-1">Why Ask This</div>
                            <p className="text-xs text-brand-muted leading-relaxed">{item.why}</p>
                          </div>
                          <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                            <div className="text-[10px] font-bold uppercase text-brand-green mb-1">Listen For</div>
                            <p className="text-xs text-brand-muted leading-relaxed">{item.listen}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {tab === 'prospects' && (
        <div>
          <div className="bg-accent-soft border border-accent rounded-xl p-4 mb-5">
            <div className="text-sm font-bold text-accent">Goal: 15 conversations in 2 weeks</div>
          </div>
          <div className="space-y-3">
            {prospectList.map((item, i) => (
              <div key={i} className="bg-white border border-brand-border rounded-xl p-5 shadow-sm">
                <div className="text-base font-bold text-brand-text mb-3">{item.type}</div>
                <div className="grid grid-cols-3 gap-4">
                  {[['Examples', item.examples], ['Where to Find', item.where], ['Approach', item.approach]].map(([l, v]) => (
                    <div key={l as string}>
                      <div className="text-[10px] font-bold uppercase text-brand-dim mb-1">{l}</div>
                      <p className="text-xs text-brand-muted leading-relaxed">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
