'use client'

import {
  ENTITY_TYPES,
  ESTABLISHED_MONTHS,
  type BusinessProfile,
} from '@/lib/credit-funding-types'

const inputClass =
  'w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-brand-text text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors'

const labelClass = 'block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide'

const bpf = (name: string) => `cf-biz-${name}`

interface Props {
  profile: BusinessProfile
  onChange: (profile: BusinessProfile) => void
  errors: Record<string, string>
}

export default function BusinessInfoSection({ profile, onChange, errors }: Props) {
  const set = <K extends keyof BusinessProfile>(key: K, value: BusinessProfile[K]) => {
    onChange({ ...profile, [key]: value })
  }

  return (
    <div className="mt-6 pt-6 border-t border-brand-border">
      <h3 className="font-serif text-lg font-bold text-brand-text mb-1">Business Information</h3>
      <p className="text-sm text-brand-muted mb-5">
        Complete this section for business funding evaluation.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor={bpf('legalName')}>Legal Business Name *</label>
          <input id={bpf('legalName')} name="legalName" className={inputClass} value={profile.legalName || ''} onChange={(e) => set('legalName', e.target.value)} />
          {errors.legalName && <p className="text-xs text-brand-red mt-1">{errors.legalName}</p>}
        </div>
        <div>
          <label className={labelClass} htmlFor={bpf('dba')}>DBA (if different)</label>
          <input id={bpf('dba')} name="dba" className={inputClass} value={profile.dba || ''} onChange={(e) => set('dba', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor={bpf('address')}>Business Address *</label>
          <input id={bpf('address')} name="businessAddress" className={inputClass} value={profile.address || ''} onChange={(e) => set('address', e.target.value)} />
          {errors.businessAddress && <p className="text-xs text-brand-red mt-1">{errors.businessAddress}</p>}
        </div>
        <div>
          <label className={labelClass} htmlFor={bpf('city')}>City *</label>
          <input id={bpf('city')} name="businessCity" className={inputClass} value={profile.city || ''} onChange={(e) => set('city', e.target.value)} />
          {errors.businessCity && <p className="text-xs text-brand-red mt-1">{errors.businessCity}</p>}
        </div>
        <div>
          <label className={labelClass} htmlFor={bpf('state')}>State *</label>
          <input id={bpf('state')} name="businessState" className={inputClass} maxLength={2} value={profile.state || ''} onChange={(e) => set('state', e.target.value.toUpperCase())} />
          {errors.businessState && <p className="text-xs text-brand-red mt-1">{errors.businessState}</p>}
        </div>
        <div>
          <label className={labelClass} htmlFor={bpf('zipCode')}>ZIP</label>
          <input id={bpf('zipCode')} name="businessZip" className={inputClass} value={profile.zipCode || ''} onChange={(e) => set('zipCode', e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor={bpf('phone')}>Business Phone</label>
          <input id={bpf('phone')} name="businessPhone" type="tel" className={inputClass} value={profile.phone || ''} onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor={bpf('email')}>Business Email</label>
          <input id={bpf('email')} name="businessEmail" type="email" className={inputClass} value={profile.email || ''} onChange={(e) => set('email', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor={bpf('website')}>Website</label>
          <input id={bpf('website')} name="website" className={inputClass} placeholder="https://" value={profile.website || ''} onChange={(e) => set('website', e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor={bpf('industry')}>Industry *</label>
          <input id={bpf('industry')} name="industry" className={inputClass} value={profile.industry || ''} onChange={(e) => set('industry', e.target.value)} />
          {errors.industry && <p className="text-xs text-brand-red mt-1">{errors.industry}</p>}
        </div>
        <div>
          <label className={labelClass} htmlFor={bpf('entityType')}>Entity Type *</label>
          <select id={bpf('entityType')} name="entityType" className={inputClass} value={profile.entityType || ''} onChange={(e) => set('entityType', e.target.value)}>
            <option value="">Select entity type</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {errors.entityType && <p className="text-xs text-brand-red mt-1">{errors.entityType}</p>}
        </div>
        <div>
          <label className={labelClass} htmlFor={bpf('monthEstablished')}>Month Opened *</label>
          <select
            id={bpf('monthEstablished')}
            name="monthEstablished"
            className={inputClass}
            value={profile.monthEstablished || ''}
            onChange={(e) => set('monthEstablished', e.target.value)}
          >
            <option value="">Select month</option>
            {ESTABLISHED_MONTHS.map((month) => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </select>
          {errors.monthEstablished && <p className="text-xs text-brand-red mt-1">{errors.monthEstablished}</p>}
        </div>
        <div>
          <label className={labelClass} htmlFor={bpf('yearEstablished')}>Year Established *</label>
          <input
            id={bpf('yearEstablished')}
            name="yearEstablished"
            className={inputClass}
            inputMode="numeric"
            maxLength={4}
            placeholder="YYYY"
            value={profile.yearEstablished || ''}
            onChange={(e) => set('yearEstablished', e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
          {errors.yearEstablished && <p className="text-xs text-brand-red mt-1">{errors.yearEstablished}</p>}
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
    </div>
  )
}
