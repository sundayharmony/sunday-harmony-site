'use client'

import { useState } from 'react'
import { detailedPackages, footInDoorOffer } from '@/lib/toolkit-data'

export default function PackagesPage() {
  const [selectedTier, setSelectedTier] = useState(0)
  const pkg = detailedPackages[selectedTier]

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Packages &amp; Pricing</h1>
        <p className="text-sm text-brand-muted">
          Detailed service breakdowns, quick wins, and margin analysis for every tier.
        </p>
      </div>

      {/* Tier Selector */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {detailedPackages.map((p, i) => (
          <button
            key={p.tier}
            onClick={() => setSelectedTier(i)}
            className={`p-4 rounded-xl border text-left transition-all ${
              selectedTier === i
                ? 'bg-gray-50 border-brand-border'
                : 'bg-white border-brand-border hover:bg-gray-50'
            } shadow-sm`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-lg" style={{ color: p.color }}>{p.icon}</span>
              {(p as { popular?: boolean }).popular && (
                <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-[rgba(184,148,63,0.1)] text-brand-gold">Popular</span>
              )}
            </div>
            <div className="text-sm font-bold text-brand-text">{p.tier}</div>
            <div className="text-xl font-extrabold mt-1" style={{ color: p.color }}>${p.price}<span className="text-[10px] text-brand-dim">/mo</span></div>
          </button>
        ))}
      </div>

      {/* Selected Package Detail */}
      <div className="grid grid-cols-[1fr_320px] gap-6 mb-8">
        {/* Services List */}
        <div className="bg-white border border-brand-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl" style={{ color: pkg.color }}>{pkg.icon}</span>
            <div>
              <h2 className="text-xl font-extrabold text-brand-text">{pkg.tier}</h2>
              <p className="text-xs text-brand-muted">{pkg.tagline}</p>
            </div>
          </div>
          <div className="text-xs text-brand-dim mb-5 mt-2">
            <span className="font-bold">Ideal for:</span> {pkg.ideal}
          </div>

          <div className="text-[10px] font-bold uppercase text-brand-dim mb-3">Services</div>
          <div className="space-y-2">
            {pkg.services.map((s, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  s.included
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <span className={`text-sm mt-0.5 ${s.included ? 'text-brand-green' : 'text-brand-dim'}`}>
                  {s.included ? '✓' : '—'}
                </span>
                <div>
                  <span className={`text-sm ${s.included ? 'text-brand-text' : 'text-brand-dim'}`}>
                    {s.name}
                  </span>
                  {s.note && (
                    <span className={`text-[10px] ml-2 ${s.included ? 'text-brand-muted' : 'text-brand-gold'}`}>
                      {s.note}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Win & Margin */}
        <div className="space-y-4">
          <div className="rounded-xl p-5 border" style={{ background: `${pkg.color}08`, borderColor: `${pkg.color}20` }}>
            <div className="text-[10px] font-bold uppercase mb-2" style={{ color: pkg.color }}>Quick Win</div>
            <p className="text-sm text-brand-text leading-relaxed">{pkg.quickWin}</p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
            <div className="text-[10px] font-bold uppercase text-brand-green mb-2">Margin Note</div>
            <p className="text-sm text-brand-muted leading-relaxed">{pkg.margin}</p>
          </div>

          <div className="bg-white border border-brand-border rounded-xl p-5 shadow-sm">
            <div className="text-[10px] font-bold uppercase text-brand-dim mb-2">Pricing</div>
            <div className="text-3xl font-extrabold" style={{ color: pkg.color }}>${pkg.price}</div>
            <div className="text-xs text-brand-dim">/month</div>
            <div className="mt-2 text-xs text-brand-muted">
              Annual value: <span className="font-bold text-brand-text">${(pkg.price * 12).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Foot-in-the-Door Offer */}
      <div className="bg-[rgba(184,148,63,0.08)] border border-brand-gold rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-brand-gold mb-1">Lead Magnet</div>
            <h3 className="text-lg font-bold text-brand-text">{footInDoorOffer.name}</h3>
            <p className="text-xs text-brand-muted mt-1">{footInDoorOffer.description}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold text-brand-green">{footInDoorOffer.price}</div>
            <div className="text-[10px] text-brand-dim mt-1">Converts at {footInDoorOffer.conversionRate.split(' ')[0]}</div>
          </div>
        </div>

        <div className="text-[10px] font-bold uppercase text-brand-dim mb-2">How to Deliver</div>
        <div className="grid grid-cols-2 gap-2">
          {footInDoorOffer.steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-200">
              <span className="text-brand-gold text-xs font-bold mt-0.5">{i + 1}.</span>
              <span className="text-xs text-brand-muted leading-relaxed">{step}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200">
          <span className="text-xs text-brand-green font-semibold">{footInDoorOffer.conversionRate}</span>
        </div>
      </div>
    </div>
  )
}
