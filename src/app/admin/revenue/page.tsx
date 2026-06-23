'use client'

import { useState } from 'react'

const tiers = [
  { key: 'social', label: 'Social Essentials', price: 250, max: 20, color: 'text-brand-text' },
  { key: 'spark', label: 'Spark', price: 500, max: 15, color: 'text-brand-text' },
  { key: 'growth', label: 'Growth', price: 1800, max: 10, color: 'text-accent' },
  { key: 'scale', label: 'Scale', price: 3500, max: 5, color: 'text-brand-text' },
]

const presets = [
  { label: 'Conservative', social: 5, spark: 5, growth: 3, scale: 1 },
  { label: 'Moderate', social: 8, spark: 6, growth: 5, scale: 2 },
  { label: 'Ambitious', social: 12, spark: 8, growth: 8, scale: 3 },
]

export default function RevenuePage() {
  const [vals, setVals] = useState<Record<string, number>>({ social: 5, spark: 5, growth: 3, scale: 1 })

  const set = (key: string, v: number) => setVals(p => ({ ...p, [key]: v }))
  const totalClients = Object.values(vals).reduce((s, v) => s + v, 0)
  const mrr = tiers.reduce((s, t) => s + (vals[t.key] || 0) * t.price, 0)

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Revenue Calculator</h1>
        <p className="text-sm text-brand-muted">Project your monthly and annual revenue across all package tiers.</p>
      </div>

      {/* Presets */}
      <div className="flex gap-2 mb-6">
        {presets.map(p => (
          <button key={p.label} onClick={() => setVals({ social: p.social, spark: p.spark, growth: p.growth, scale: p.scale })}
            className="px-4 py-2 rounded-lg bg-gray-50 border border-brand-border text-xs font-semibold text-brand-muted hover:text-accent transition-all">
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Sliders */}
        <div className="bg-white border border-brand-border rounded-xl p-6 shadow-sm">
          {tiers.map(tier => (
            <div key={tier.key} className="mb-6 last:mb-0">
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-sm font-semibold text-brand-muted">{tier.label} (${tier.price}/mo)</span>
                <span className={`font-serif text-xl font-extrabold ${tier.color}`}>{vals[tier.key]}</span>
              </div>
              <input type="range" min="0" max={tier.max} value={vals[tier.key]}
                onChange={e => set(tier.key, parseInt(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none bg-gray-200 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-text [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,0,0,0.12)]" />
              <div className="flex justify-between text-[10px] text-brand-dim mt-1">
                <span>0</span><span>{tier.max}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Results */}
        <div>
          <div className="bg-accent-soft border border-accent rounded-xl p-6 text-center mb-4">
            <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-accent mb-2">Monthly Revenue</div>
            <div className="font-serif text-5xl font-extrabold text-brand-text">${mrr.toLocaleString()}</div>
            <div className="text-sm text-brand-dim mt-1">{totalClients} total clients</div>
          </div>

          <div className="bg-gray-50 border border-brand-border rounded-xl p-5">
            {tiers.map(tier => (
              <div key={tier.key} className="flex justify-between py-2 border-b border-gray-200 last:border-0">
                <span className="text-sm text-brand-muted">{tier.label}</span>
                <span className="text-sm font-semibold text-brand-text">${((vals[tier.key] || 0) * tier.price).toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3 mt-1">
              <span className="text-sm font-bold text-accent">Annual Revenue</span>
              <span className="text-sm font-extrabold text-accent">${(mrr * 12).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
