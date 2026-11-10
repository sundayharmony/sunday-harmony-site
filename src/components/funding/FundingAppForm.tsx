'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { HONEYPOT_FIELD_NAME } from '@/lib/honeypot'
import {
  FUNDING_AMOUNT_OPTIONS,
  FUNDING_REASON_OPTIONS,
  MYFICO_URL,
} from '@/lib/fundingapp-fields'
import { reportGoogleAdsLeadConversion } from '@/lib/google-ads'

const inputClass =
  'w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-brand-text text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors'

const labelClass = 'block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide'

export default function FundingAppForm() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [applicationId, setApplicationId] = useState('')

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setError('')
    const form = event.currentTarget
    const data = new FormData(form)
    const pin = String(data.get('experianPin') || '').replace(/\D/g, '')
    if (pin.length !== 4) {
      setError('Experian PIN must be 4 digits')
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch('/api/fundingapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: data.get('firstName'),
          lastName: data.get('lastName'),
          email: data.get('email'),
          phone: data.get('phone'),
          fundingAmount: data.get('fundingAmount'),
          whyFunding: data.get('whyFunding'),
          creditScore: data.get('creditScore'),
          llcCreated: data.get('llcCreated'),
          businessRevenue: data.get('businessRevenue'),
          personalAccounts: data.get('personalAccounts'),
          derogatoryAccounts: data.get('derogatoryAccounts'),
          monitoringUsername: data.get('monitoringUsername'),
          monitoringPassword: data.get('monitoringPassword'),
          experianSecurityAnswer: data.get('experianSecurityAnswer'),
          experianPin: pin,
          authorizeExperian: data.get('authorizeExperian') === 'on',
          [HONEYPOT_FIELD_NAME]: data.get(HONEYPOT_FIELD_NAME),
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(typeof payload.error === 'string' ? payload.error : 'Failed to save application. Please try again.')
        return
      }
      reportGoogleAdsLeadConversion()
      setApplicationId(typeof payload.applicationId === 'string' ? payload.applicationId : '')
    } catch {
      setError('Failed to save application. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (applicationId) {
    return (
      <div className="bg-white border border-brand-border rounded-2xl p-8 sm:p-10 text-center shadow-sm">
        <div className="text-5xl mb-4">✓</div>
        <h2 className="font-serif text-2xl font-bold text-brand-text mb-3">Application Submitted</h2>
        <p className="text-brand-muted mb-4">
          Thank you! We&apos;ve received your Credit &amp; Funding application and sent a confirmation to your email.
        </p>
        <p className="inline-block px-4 py-2 bg-accent-soft border border-brand-border rounded-lg text-sm font-semibold text-brand-text">
          Application ID: {applicationId}
        </p>
        <p className="text-sm text-brand-muted mt-6">
          Track your application status anytime from your{' '}
          <Link href="/dashboard/credit-funding" className="text-accent font-semibold hover:underline">
            client portal
          </Link>{' '}
          (log in with the email you used to apply).
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      autoComplete="off"
      className="bg-white border border-brand-border rounded-2xl shadow-sm overflow-hidden"
    >
      <div className="p-6 sm:p-8">
        <div className="hidden" aria-hidden="true">
          <label htmlFor="fundingapp-honeypot">Office fax</label>
          <input id="fundingapp-honeypot" name={HONEYPOT_FIELD_NAME} tabIndex={-1} autoComplete="off" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="First Name" name="firstName" autoComplete="given-name" placeholder="First Name" />
          <Field label="Last Name" name="lastName" autoComplete="family-name" placeholder="Last Name" />
          <Field label="Email" name="email" type="email" autoComplete="email" placeholder="Email" />
          <Field label="Phone" name="phone" type="tel" autoComplete="tel" placeholder="Phone" />
          <div className="sm:col-span-2">
            <Select
              label="How Much Funding Do You Need"
              name="fundingAmount"
              options={FUNDING_AMOUNT_OPTIONS}
              placeholder="How Much Funding Do You Need?"
            />
          </div>
          <div className="sm:col-span-2">
            <Select
              label="Why are you looking for funding?"
              name="whyFunding"
              options={FUNDING_REASON_OPTIONS}
              placeholder="Why are you looking for funding?"
            />
          </div>
          <div className="sm:col-span-2">
            <Field label="Credit Score" name="creditScore" inputMode="numeric" placeholder="Credit Score" />
          </div>
          <div className="sm:col-span-2">
            <Field
              label="When was your LLC Created? (If you don't have one put N/A)"
              name="llcCreated"
              placeholder="Month & Year"
            />
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Is Your Business Generating Revenue Yet? (If yes put Business Revenue)"
              name="businessRevenue"
              placeholder="Is Your Business Generating Revenue Yet? (If yes put Business Revenue)"
            />
          </div>
          <div className="sm:col-span-2">
            <Field
              label="How many personal accounts do you have? (Open & closed, provide a range)"
              name="personalAccounts"
              placeholder="How many accounts do you have? (Open & closed, provide a range)"
            />
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Do you have any derogatory accounts (charge offs, collections, repossessions) or late payments within the last 2 years?"
              name="derogatoryAccounts"
              placeholder="Any derogatory accounts or late payments within the last 2 years?"
            />
          </div>
        </div>

        <div className="mt-5 p-4 bg-neutral-50 border border-brand-border rounded-xl text-sm text-brand-text leading-relaxed">
          <p className="font-semibold">
            Your Experian Login is Required for our consultation. Please provide your login credentials. If you
            don&apos;t have an{' '}
            <a className="text-accent font-semibold hover:underline" href={MYFICO_URL} target="_blank" rel="noopener noreferrer">
              My Fico
            </a>{' '}
            account, please{' '}
            <a className="text-accent font-semibold hover:underline" href={MYFICO_URL} target="_blank" rel="noopener noreferrer">
              click this link
            </a>{' '}
            and create a free account!
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
          <div className="sm:col-span-2">
            <Field label="Credit Monitoring Username" name="monitoringUsername" autoComplete="off" placeholder="Username" />
          </div>
          <Field
            label="Credit Monitoring Password"
            name="monitoringPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Password"
          />
          <Field
            label="Experian Four Digit Pin"
            name="experianPin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Experian 4 Digit Pin"
            maxLength={4}
          />
          <div className="sm:col-span-2">
            <Field
              label="Experian Security Question Answer"
              name="experianSecurityAnswer"
              autoComplete="off"
              placeholder="Experian Security Question Answer"
            />
          </div>
        </div>

        <label htmlFor="fundingapp-authorize" className="mt-6 flex items-start gap-3 cursor-pointer">
          <input id="fundingapp-authorize" name="authorizeExperian" type="checkbox" required className="mt-1" />
          <span className="text-sm text-brand-muted">
            I confirm this information is accurate and I authorize Sunday Harmony to use the Experian login I
            provided for my consultation.
          </span>
        </label>

        {error ? (
          <p className="text-sm text-brand-red mt-4 px-1" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end mt-8 pt-6 border-t border-brand-border">
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-6 py-2.5 rounded-md bg-brand-text text-white font-semibold text-sm hover:bg-neutral-800 disabled:opacity-60 transition-all"
          >
            {submitting ? 'Submitting…' : 'Submit Application'}
          </button>
        </div>
      </div>
    </form>
  )
}

function Field({
  label,
  name,
  type = 'text',
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
}: {
  label: string
  name: string
  type?: string
  placeholder?: string
  autoComplete?: string
  inputMode?: 'numeric' | 'text' | 'email' | 'tel'
  maxLength?: number
}) {
  const id = `fundingapp-${name}`
  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label} *
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        className={inputClass}
      />
    </div>
  )
}

function Select({
  label,
  name,
  options,
  placeholder,
}: {
  label: string
  name: string
  options: readonly string[]
  placeholder?: string
}) {
  const id = `fundingapp-${name}`
  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label} *
      </label>
      <select id={id} name={name} required defaultValue="" className={inputClass}>
        <option value="" disabled>
          {placeholder || label}
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}
