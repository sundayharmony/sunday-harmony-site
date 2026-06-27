import type { InputHTMLAttributes, ReactNode } from 'react'

const inputClass =
  'w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-lg text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  labelExtra?: ReactNode
}

export default function AuthInput({ label, labelExtra, id, className = '', ...props }: Props) {
  const inputId = id || props.name || label.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1.5">
        <label htmlFor={inputId} className="block text-xs font-semibold text-brand-muted tracking-wide">
          {label}
        </label>
        {labelExtra}
      </div>
      <input id={inputId} className={`${inputClass} ${className}`} {...props} />
    </div>
  )
}

export function AuthErrorAlert({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{message}</div>
  )
}

export { inputClass as authInputClass }
