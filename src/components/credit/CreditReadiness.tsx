'use client'

import { useState } from 'react'

const CHECKS = [
  'I have checked my reports in the last 12 months (or I am ready to pull them)',
  'I know which accounts are open, closed, or in collections',
  'My revolving balances are mostly under about 30% of their limits',
  'Nothing is currently past due—or I have a plan to catch up',
  'I have a photo ID and proof of address I can upload',
  'I know what I want credit to unlock (home, auto, business, etc.)',
] as const

const RADIUS = 56
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function readinessMessage(count: number): { title: string; body: string } {
  if (count === 0) return { title: 'Start here', body: 'Check what is true today. Gaps are normal—they tell us what to tackle first.' }
  if (count <= 2) return { title: 'Getting oriented', body: 'A few basics are in place. The intake helps us see the full picture across bureaus.' }
  if (count <= 4) return { title: 'Building clarity', body: 'You are past the guesswork stage. The remaining items are usually quick fixes.' }
  if (count === 5) return { title: 'Almost ready', body: 'One item left. You can still submit—the review will call out what to gather next.' }
  return { title: 'Ready to submit', body: 'You have the core pieces. The secure intake below is the next step.' }
}

export default function CreditReadiness() {
  const [checked, setChecked] = useState<boolean[]>(() => CHECKS.map(() => false))
  const count = checked.filter(Boolean).length
  const progress = count / CHECKS.length
  const message = readinessMessage(count)

  const toggle = (index: number) => {
    setChecked((prev) => prev.map((value, i) => (i === index ? !value : value)))
  }

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,200px)_1fr] items-center rounded-3xl border border-brand-border bg-white p-6 sm:p-8 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <div className="relative h-[150px] w-[150px]">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="70" cy="70" r={RADIUS} fill="none" stroke="#f0ebe3" strokeWidth="12" />
            <circle
              cx="70"
              cy="70"
              r={RADIUS}
              fill="none"
              stroke="#b8943f"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
              style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.22, 1, 0.36, 1)' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-serif text-[40px] font-extrabold leading-none text-brand-text">{count}</span>
            <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-dim">of {CHECKS.length}</span>
          </div>
        </div>
        <p className="mt-4 font-serif text-xl font-bold text-brand-text" aria-live="polite">{message.title}</p>
        <p className="mt-1 text-xs text-brand-muted leading-relaxed max-w-[200px]">{message.body}</p>
      </div>

      <ul className="grid gap-2.5">
        {CHECKS.map((label, index) => (
          <li key={label}>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all ${
                checked[index]
                  ? 'border-accent bg-accent-soft text-brand-text'
                  : 'border-brand-border bg-white text-brand-muted hover:border-neutral-300'
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked[index]}
                onChange={() => toggle(index)}
              />
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[12px] font-bold transition-all ${
                  checked[index] ? 'border-accent bg-accent text-white scale-110' : 'border-brand-border bg-neutral-50 text-transparent'
                }`}
              >
                ✓
              </span>
              <span className="leading-snug">{label}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
