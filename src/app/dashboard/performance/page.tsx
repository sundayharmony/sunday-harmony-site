'use client'

import { useState } from 'react'

// Simulated performance data — in production, this would come from API integrations
const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb']

const metricsData = {
  'Website Visits': { values: [120, 245, 389, 512, 640, 780], color: '#3a8bc2', unit: '' },
  'Google Searches': { values: [45, 89, 134, 198, 267, 320], color: '#4a9e7d', unit: '' },
  'Phone Calls': { values: [3, 8, 14, 22, 31, 38], color: '#c9a96e', unit: '' },
  'Form Submissions': { values: [1, 4, 9, 15, 22, 28], color: '#7b68c9', unit: '' },
}

const activityLog = [
  { date: '2026-02-20', action: 'Published 3 social media posts (Instagram, Facebook)', category: 'Social Media' },
  { date: '2026-02-18', action: 'Optimized Google Business Profile — added 6 new photos', category: 'Local SEO' },
  { date: '2026-02-15', action: 'Monthly SEO report generated — rankings improved for 4 keywords', category: 'SEO' },
  { date: '2026-02-12', action: 'Responded to 2 Google reviews on your behalf', category: 'Reputation' },
  { date: '2026-02-10', action: 'Launched email campaign — 340 recipients, 28% open rate', category: 'Email' },
  { date: '2026-02-07', action: 'Website speed optimization — load time reduced by 1.2s', category: 'Website' },
  { date: '2026-02-05', action: 'Created February content calendar and scheduled posts', category: 'Social Media' },
  { date: '2026-02-01', action: 'Monthly strategy call completed — Q2 goals defined', category: 'Strategy' },
]

const categoryColors: Record<string, string> = {
  'Social Media': '#3a8bc2',
  'Local SEO': '#4a9e7d',
  'SEO': '#4a9e7d',
  'Reputation': '#c9a96e',
  'Email': '#7b68c9',
  'Website': '#3a8bc2',
  'Strategy': '#c9a96e',
}

export default function PerformancePage() {
  const [selectedMetric, setSelectedMetric] = useState<string>('Website Visits')

  const metric = metricsData[selectedMetric as keyof typeof metricsData]
  const maxVal = Math.max(...metric.values)
  const currentVal = metric.values[metric.values.length - 1]
  const prevVal = metric.values[metric.values.length - 2]
  const changePercent = prevVal > 0 ? Math.round(((currentVal - prevVal) / prevVal) * 100) : 0

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Performance</h1>
        <p className="text-sm text-brand-muted">Track your marketing results over time.</p>
      </div>

      {/* Metric Selector */}
      <div className="flex gap-3 mb-6">
        {Object.entries(metricsData).map(([name, data]) => {
          const val = data.values[data.values.length - 1]
          return (
            <button
              key={name}
              onClick={() => setSelectedMetric(name)}
              className={`flex-1 p-4 rounded-xl border transition-all ${
                selectedMetric === name
                  ? 'bg-gray-50 border-brand-border'
                  : 'bg-white border-brand-border hover:bg-gray-50'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wide text-brand-dim mb-1">{name}</div>
              <div className="text-2xl font-extrabold" style={{ color: data.color }}>
                {val.toLocaleString()}
              </div>
            </button>
          )
        })}
      </div>

      {/* Chart Area */}
      <div className="bg-white border border-brand-border rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-brand-text">{selectedMetric}</h2>
            <span className="text-xs text-brand-muted">Last 6 months</span>
          </div>
          <div className={`text-sm font-bold ${changePercent >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
            {changePercent >= 0 ? '↑' : '↓'} {Math.abs(changePercent)}% vs last month
          </div>
        </div>

        {/* Simple bar chart */}
        <div className="flex items-end gap-3 h-48">
          {metric.values.map((val, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-brand-muted font-semibold">{val}</span>
              <div
                className="w-full rounded-t-lg transition-all"
                style={{
                  height: `${maxVal > 0 ? (val / maxVal) * 160 : 0}px`,
                  background: i === metric.values.length - 1
                    ? metric.color
                    : `${metric.color}66`,
                  minHeight: '4px',
                }}
              />
              <span className="text-[10px] text-brand-dim">{months[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="text-[10px] font-bold uppercase text-brand-green mb-1">Best Month</div>
          <div className="text-lg font-extrabold text-brand-text">February</div>
          <p className="text-xs text-brand-muted mt-1">780 website visits — your highest yet</p>
        </div>
        <div className="bg-[rgba(184,148,63,0.08)] border border-brand-gold rounded-xl p-4">
          <div className="text-[10px] font-bold uppercase text-brand-gold mb-1">Conversion Rate</div>
          <div className="text-lg font-extrabold text-brand-text">4.9%</div>
          <p className="text-xs text-brand-muted mt-1">Form submissions ÷ website visits</p>
        </div>
        <div className="bg-[rgba(58,139,194,0.08)] border border-[rgba(58,139,194,0.15)] rounded-xl p-4">
          <div className="text-[10px] font-bold uppercase text-[#3a8bc2] mb-1">Total Growth</div>
          <div className="text-lg font-extrabold text-brand-text">550%</div>
          <p className="text-xs text-brand-muted mt-1">Website traffic since start</p>
        </div>
      </div>

      {/* Activity Log */}
      <div className="bg-white border border-brand-border rounded-2xl p-6">
        <h2 className="text-base font-bold text-brand-text mb-4">Activity Log</h2>
        <p className="text-xs text-brand-muted mb-4">Everything we&rsquo;ve done for your business this month.</p>
        <div className="space-y-3">
          {activityLog.map((item, i) => (
            <div key={i} className="flex items-start gap-4 p-3 rounded-lg bg-gray-50 border border-brand-border">
              <div className="text-xs text-brand-dim whitespace-nowrap pt-0.5">
                {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              <div className="flex-1">
                <p className="text-sm text-brand-text">{item.action}</p>
              </div>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  color: categoryColors[item.category] || '#c9a96e',
                  background: `${categoryColors[item.category] || '#c9a96e'}15`,
                  border: `1px solid ${categoryColors[item.category] || '#c9a96e'}30`,
                }}
              >
                {item.category}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
