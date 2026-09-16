'use client'

import {
  BILLING_PACKAGE_KEYS,
  billingPackageLabel,
  billingPackagePriceLabel,
  type BillingPackageKey,
} from '@/lib/billing-packages'

export default function AdminBillingPackagePicker({
  selected,
  onSelect,
  disabled = false,
}: {
  selected: BillingPackageKey
  onSelect: (key: BillingPackageKey) => void
  disabled?: boolean
}) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase text-brand-dim mb-2">Package</div>
      <div className="flex flex-wrap gap-1.5">
        {BILLING_PACKAGE_KEYS.map(key => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(key)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all disabled:opacity-50 ${
              selected === key
                ? 'bg-accent-soft text-accent border border-accent'
                : 'bg-gray-50 text-brand-dim border border-brand-border'
            }`}
          >
            {billingPackageLabel(key)} ({billingPackagePriceLabel(key)})
          </button>
        ))}
      </div>
    </div>
  )
}
