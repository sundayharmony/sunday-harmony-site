'use client'

import { useState } from 'react'
import { formatSsnWhileTyping, maskSsnLast4, normalizeSsnDigits } from '@/lib/ssn-utils'

interface Props {
  value: string
  onChange: (digits: string) => void
  error?: string
  className?: string
  id?: string
}

export default function SsnInputField({ value, onChange, error, className = '', id = 'ssn' }: Props) {
  const [focused, setFocused] = useState(false)

  const displayValue = focused
    ? formatSsnWhileTyping(value)
    : value.length === 9
      ? maskSsnLast4(value)
      : formatSsnWhileTyping(value)

  return (
    <div>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        aria-label="Social Security Number"
        placeholder="XXX-XX-XXXX"
        className={className}
        value={displayValue}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(normalizeSsnDigits(e.target.value))}
      />
      {!focused && value.length === 9 && (
        <p className="text-xs text-brand-dim mt-1">Only the last four digits are shown for your security.</p>
      )}
      {error && <p className="text-xs text-brand-red mt-1">{error}</p>}
    </div>
  )
}
