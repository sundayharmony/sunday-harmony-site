'use client'

import { useRef, useState, FormEvent } from 'react'
import Link from 'next/link'
import { contactLeadSource } from '@/components/ContactForm'
import { reportGoogleAdsLeadConversion } from '@/lib/google-ads'
import TurnstileWidget, { TURNSTILE_WAIT_MESSAGE, turnstileTokenForSubmit, type TurnstileHandle } from '@/components/TurnstileWidget'

const empty = { firstName: '', lastName: '', business: '', website: '', email: '', phone: '', problem: '', shHpField: '' }
type Field = keyof typeof empty

const input =
  'w-full min-h-[48px] py-3 px-4 bg-brand-bg border border-brand-border rounded-[14px] text-brand-text text-base outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors'
const label = 'block text-sm font-semibold text-brand-text mb-1.5'
const opt = <span className="font-normal text-brand-dim">(optional)</span>

export default function AuditForm({ offer }: { offer: string }) {
  const [form, setForm] = useState(empty)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const turnstile = useRef<TurnstileHandle>(null)
  const update = (field: Field, value: string) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSending(true)
    try {
      const turnstileToken = await turnstileTokenForSubmit(turnstile.current)
      if (turnstileToken === null) throw new Error(TURNSTILE_WAIT_MESSAGE)
      // The contact API has no website field, so it rides in the message.
      const message = [
        `Free audit request (${offer} ad page).`,
        `Website: ${form.website.trim() || 'none'}`,
        form.problem.trim() && `Biggest problem: ${form.problem.trim()}`,
      ]
        .filter(Boolean)
        .join('\n')
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          business: form.business,
          service: offer,
          message,
          shHpField: form.shHpField,
          source: contactLeadSource(),
          turnstileToken,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Something went wrong')
      }
      reportGoogleAdsLeadConversion()
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send. Please email sales@sundayharmony.com.')
    } finally {
      turnstile.current?.reset()
      setSending(false)
    }
  }

  const card = 'bg-brand-paper border border-brand-border rounded-[28px] p-6 sm:p-8 shadow-[0_18px_40px_-24px_rgba(27,26,23,0.35)]'

  if (sent) {
    return (
      <div className={`${card} text-center py-12`}>
        <h2 ref={(el) => el?.focus()} tabIndex={-1} className="font-serif text-[28px] font-semibold tracking-[-0.015em] text-brand-text mb-3 outline-none">
          Request received.
        </h2>
        <p className="text-brand-muted leading-relaxed mb-6">
          We&apos;ll be in touch within 24 hours with your free audit. Want to talk it through? Pick a time now.
        </p>
        <Link href="/book" className="inline-flex items-center justify-center min-h-[48px] px-8 rounded-full bg-brand-text text-brand-bg font-semibold">
          Book a call
        </Link>
      </div>
    )
  }

  return (
    <form id="form" onSubmit={handleSubmit} className={`${card} grid gap-4 scroll-mt-6`}>
      <h2 className="font-serif text-[28px] font-semibold tracking-[-0.015em] text-brand-text">Get your free audit</h2>
      <div className="hidden" aria-hidden="true">
        <label htmlFor="audit-sh-hp-field">Office fax</label>
        <input id="audit-sh-hp-field" name="sh_hp_field" type="text" tabIndex={-1} autoComplete="off" value={form.shHpField} onChange={(e) => update('shHpField', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="audit-first" className={label}>First name</label>
          <input id="audit-first" required autoComplete="given-name" value={form.firstName} onChange={(e) => update('firstName', e.target.value)} className={input} />
        </div>
        <div>
          <label htmlFor="audit-last" className={label}>Last name</label>
          <input id="audit-last" autoComplete="family-name" value={form.lastName} onChange={(e) => update('lastName', e.target.value)} className={input} />
        </div>
      </div>
      <div>
        <label htmlFor="audit-business" className={label}>Business name</label>
        <input id="audit-business" required autoComplete="organization" value={form.business} onChange={(e) => update('business', e.target.value)} className={input} />
      </div>
      <div>
        <label htmlFor="audit-website" className={label}>Website {opt}</label>
        <input id="audit-website" maxLength={200} placeholder="Leave blank if you don't have one" value={form.website} onChange={(e) => update('website', e.target.value)} className={input} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="audit-email" className={label}>Email</label>
          <input id="audit-email" type="email" required autoComplete="email" value={form.email} onChange={(e) => update('email', e.target.value)} className={input} />
        </div>
        <div>
          <label htmlFor="audit-phone" className={label}>Phone</label>
          <input id="audit-phone" type="tel" required maxLength={30} autoComplete="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} className={input} />
        </div>
      </div>
      <div>
        <label htmlFor="audit-problem" className={label}>Biggest problem right now {opt}</label>
        <textarea id="audit-problem" rows={3} maxLength={2000} value={form.problem} onChange={(e) => update('problem', e.target.value)} className={`${input} resize-y`} />
      </div>
      <TurnstileWidget ref={turnstile} action="contact" />
      {error && <div className="text-brand-red text-sm" role="alert">{error}</div>}
      <button type="submit" disabled={sending} className="min-h-[52px] rounded-full bg-brand-text text-brand-bg font-semibold disabled:opacity-60 disabled:cursor-not-allowed">
        {sending ? 'Sending...' : 'Send my free audit request'}
      </button>
      <p className="text-[13px] text-brand-dim">We reply within 24 hours. No spam.</p>
    </form>
  )
}
