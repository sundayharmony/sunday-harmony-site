'use client'

import { useState } from 'react'
import { channels, outreachScripts } from '@/lib/toolkit-data'

export default function OutreachPage() {
  const [tab, setTab] = useState<'channels' | 'scripts'>('channels')
  const [copied, setCopied] = useState<number | null>(null)

  const copy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text)
    setCopied(idx)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Outreach & Scripts</h1>
        <p className="text-sm text-brand-muted">Your acquisition channels and ready-to-use outreach templates.</p>
      </div>

      <div className="flex gap-2 mb-6">
        {[['channels', 'Acquisition Channels'], ['scripts', 'Outreach Scripts']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as typeof tab)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${tab === key ? 'bg-[rgba(201,169,110,0.12)] border border-[rgba(201,169,110,0.3)] text-brand-gold' : 'bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] text-brand-muted'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'channels' && (
        <div className="space-y-3">
          {channels.map((ch, i) => (
            <div key={i} className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-base font-bold text-brand-text">{ch.name}</h3>
                  <p className="text-sm text-brand-muted mt-1">{ch.description}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${ch.priority === 1 ? 'bg-[rgba(74,158,125,0.15)] text-brand-green' : ch.priority === 2 ? 'bg-[rgba(201,169,110,0.15)] text-brand-gold' : 'bg-[rgba(58,139,194,0.15)] text-brand-blue'}`}>
                  P{ch.priority}
                </span>
              </div>

              <div className="flex gap-4 mb-3">
                {[['Effort', ch.effort], ['Cost', ch.cost], ['Timeline', ch.timeline], ['Conversion', ch.conversion]].map(([l, v]) => (
                  <div key={l as string} className="text-center">
                    <div className="text-[10px] font-bold uppercase text-brand-dim">{l}</div>
                    <div className="text-xs font-semibold text-brand-text">{v}</div>
                  </div>
                ))}
              </div>

              <div className="bg-[rgba(255,255,255,0.02)] rounded-lg p-3">
                <div className="text-[10px] font-bold uppercase text-brand-dim mb-2">How To</div>
                {ch.steps.map((s, j) => (
                  <div key={j} className="flex gap-2 mb-1 text-xs text-brand-muted">
                    <span className="text-brand-gold flex-shrink-0">{j + 1}.</span>{s}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'scripts' && (
        <div className="space-y-4">
          {outreachScripts.map((script, i) => (
            <div key={i} className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-base font-bold text-brand-text">{script.title}</h3>
                <button onClick={() => copy(script.body, i)}
                  className="px-3 py-1.5 rounded-lg bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.2)] text-xs font-semibold text-brand-gold hover:bg-[rgba(201,169,110,0.15)] transition-all">
                  {copied === i ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="text-sm text-brand-muted leading-relaxed whitespace-pre-wrap font-sans bg-[rgba(255,255,255,0.02)] p-4 rounded-lg border border-[rgba(255,255,255,0.04)]">
                {script.body}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
