'use client'

import {
  ENTITY_TYPES,
  FUNDING_PURPOSE_OPTIONS,
  type BusinessProfile,
} from '@/lib/credit-funding-types'

const inputClass =
  'w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-brand-text text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors'

const labelClass = 'block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide'

interface Props {
  profile: BusinessProfile
  onChange: (profile: BusinessProfile) => void
  errors: Record<string, string>
}

function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string
  value?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-neutral-50 rounded-lg border border-brand-border sm:col-span-2">
      <span className="text-sm text-brand-muted">{label}</span>
      <div className="flex gap-3">
        {[true, false].map((val) => (
          <label key={String(val)} className="flex items-center gap-1 text-sm cursor-pointer">
            <input type="radio" checked={value === val} onChange={() => onChange(val)} />
            {val ? 'Yes' : 'No'}
          </label>
        ))}
      </div>
    </div>
  )
}

export default function BusinessInfoSection({ profile, onChange, errors }: Props) {
  const set = <K extends keyof BusinessProfile>(key: K, value: BusinessProfile[K]) => {
    onChange({ ...profile, [key]: value })
  }

  const togglePurpose = (purpose: string) => {
    const current = profile.fundingPurposes || []
    set(
      'fundingPurposes',
      current.includes(purpose) ? current.filter((p) => p !== purpose) : [...current, purpose]
    )
  }

  return (
    <div className="mt-6 pt-6 border-t border-brand-border">
      <h3 className="font-serif text-lg font-bold text-brand-text mb-1">Business Information</h3>
      <p className="text-sm text-brand-muted mb-5">
        Complete this section for business funding evaluation.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="sm:col-span-2">
          <label className={labelClass}>Legal Business Name *</label>
          <input className={inputClass} value={profile.legalName || ''} onChange={(e) => set('legalName', e.target.value)} />
          {errors.legalName && <p className="text-xs text-brand-red mt-1">{errors.legalName}</p>}
        </div>
        <div>
          <label className={labelClass}>DBA (if different)</label>
          <input className={inputClass} value={profile.dba || ''} onChange={(e) => set('dba', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>EIN *</label>
          <input className={inputClass} placeholder="XX-XXXXXXX" value={profile.ein || ''} onChange={(e) => set('ein', e.target.value)} />
          {errors.ein && <p className="text-xs text-brand-red mt-1">{errors.ein}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Business Address *</label>
          <input className={inputClass} value={profile.address || ''} onChange={(e) => set('address', e.target.value)} />
          {errors.businessAddress && <p className="text-xs text-brand-red mt-1">{errors.businessAddress}</p>}
        </div>
        <div>
          <label className={labelClass}>City *</label>
          <input className={inputClass} value={profile.city || ''} onChange={(e) => set('city', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>State *</label>
          <input className={inputClass} maxLength={2} value={profile.state || ''} onChange={(e) => set('state', e.target.value.toUpperCase())} />
        </div>
        <div>
          <label className={labelClass}>ZIP</label>
          <input className={inputClass} value={profile.zipCode || ''} onChange={(e) => set('zipCode', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Business Phone</label>
          <input type="tel" className={inputClass} value={profile.phone || ''} onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Business Email</label>
          <input type="email" className={inputClass} value={profile.email || ''} onChange={(e) => set('email', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Website</label>
          <input className={inputClass} placeholder="https://" value={profile.website || ''} onChange={(e) => set('website', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Industry *</label>
          <input className={inputClass} value={profile.industry || ''} onChange={(e) => set('industry', e.target.value)} />
          {errors.industry && <p className="text-xs text-brand-red mt-1">{errors.industry}</p>}
        </div>
        <div>
          <label className={labelClass}>Entity Type *</label>
          <select className={inputClass} value={profile.entityType || ''} onChange={(e) => set('entityType', e.target.value)}>
            <option value="">Select entity type</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {errors.entityType && <p className="text-xs text-brand-red mt-1">{errors.entityType}</p>}
        </div>
        <div>
          <label className={labelClass}>Year Established</label>
          <input className={inputClass} value={profile.yearEstablished || ''} onChange={(e) => set('yearEstablished', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Number of Employees</label>
          <input className={inputClass} value={profile.numberOfEmployees || ''} onChange={(e) => set('numberOfEmployees', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Annual Revenue</label>
          <input className={inputClass} placeholder="$" value={profile.annualRevenue || ''} onChange={(e) => set('annualRevenue', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Business Description</label>
          <textarea className={`${inputClass} min-h-[80px]`} value={profile.businessDescription || ''} onChange={(e) => set('businessDescription', e.target.value)} />
        </div>
      </div>

      <h4 className="text-sm font-bold text-brand-text mb-3">Business Credit Profile</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className={labelClass}>Business Credit Score</label>
          <input className={inputClass} value={profile.businessCreditScore || ''} onChange={(e) => set('businessCreditScore', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Paydex Score</label>
          <input className={inputClass} value={profile.paydexScore || ''} onChange={(e) => set('paydexScore', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Open Business Credit Cards</label>
          <input className={inputClass} type="number" min="0" value={profile.businessCreditCards || ''} onChange={(e) => set('businessCreditCards', e.target.value)} />
        </div>
        <YesNoField label="Outstanding business loans?" value={profile.businessLoans} onChange={(v) => set('businessLoans', v)} />
        <YesNoField label="Business collections?" value={profile.businessCollections} onChange={(v) => set('businessCollections', v)} />
      </div>

      <h4 className="text-sm font-bold text-brand-text mb-3">Funding Requirements</h4>
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {FUNDING_PURPOSE_OPTIONS.map((purpose) => (
          <label key={purpose} className="flex items-center gap-2 text-sm text-brand-muted cursor-pointer p-2 rounded-lg hover:bg-neutral-50">
            <input type="checkbox" checked={(profile.fundingPurposes || []).includes(purpose)} onChange={() => togglePurpose(purpose)} />
            {purpose}
          </label>
        ))}
      </div>
      {errors.fundingPurposes && <p className="text-xs text-brand-red mb-4">{errors.fundingPurposes}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <YesNoField label="Existing business debt?" value={profile.existingBusinessDebt} onChange={(v) => set('existingBusinessDebt', v)} />
        <YesNoField label="Collateral available?" value={profile.collateralAvailable} onChange={(v) => set('collateralAvailable', v)} />
        <YesNoField label="Prior business funding?" value={profile.priorBusinessFunding} onChange={(v) => set('priorBusinessFunding', v)} />
        <YesNoField label="Tax liens or judgments?" value={profile.taxLiensOrJudgments} onChange={(v) => set('taxLiensOrJudgments', v)} />
      </div>
    </div>
  )
}
