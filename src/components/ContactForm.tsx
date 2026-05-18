'use client'

import { useState, FormEvent } from 'react'
import { siteConfig, serviceOptions } from '@/lib/data'

interface FormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  business: string
  service: string
  message: string
}

export default function ContactForm() {
  const [form, setForm] = useState<FormData>({
    firstName: '', lastName: '', email: '', phone: '', business: '', service: '', message: '',
  })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSending(true)

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Something went wrong')
      }

      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send. Please email us directly.')
    } finally {
      setSending(false)
    }
  }

  const update = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  return (
    <section className="py-24 pt-8" id="contact">
      <div className="max-w-[1100px] mx-auto px-7">
        <div className="section-label">Get In Touch</div>
        <h2 className="font-serif text-[clamp(32px,5vw,52px)] font-extrabold leading-[1.12] text-brand-text mb-5">
          Let&apos;s talk about <span className="gold-text">your business</span>
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-12">
          {/* Info */}
          <div>
            <h3 className="font-serif text-[28px] font-bold text-brand-text mb-4">
              Your free audit is one message away
            </h3>
            <p className="text-[15px] text-brand-muted mb-7 leading-relaxed">
              Fill out the form and we&apos;ll get back to you within 24 hours with a personalized audit of your online presence &ndash; completely free, no obligation.
            </p>

            {[
              { icon: '✉', label: 'Email', display: siteConfig.email, href: `mailto:${siteConfig.email}` },
              {
                icon: '🌐',
                label: 'Website',
                display: siteConfig.url.replace(/^https?:\/\//, '').replace(/^www\./, ''),
                href: siteConfig.url,
                external: true,
              },
              { icon: '📍', label: 'Location', display: siteConfig.location },
            ].map((item) => (
              <div key={item.label} className="flex gap-3.5 items-start mb-5">
                <div className="w-10 h-10 rounded-[10px] bg-accent-soft border border-brand-border flex items-center justify-center text-base flex-shrink-0">
                  {item.icon}
                </div>
                <div>
                  <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-0.5">
                    {item.label}
                  </div>
                  <div className="text-[15px] text-brand-text font-medium">
                    {'href' in item ? (
                      <a
                        href={item.href}
                        className="hover:text-accent transition-colors"
                        {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      >
                        {item.display}
                      </a>
                    ) : (
                      item.display
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="bg-white border border-brand-border rounded-[20px] p-9 shadow-sm">
            {sent ? (
              <div className="text-center py-10">
                <div className="text-5xl mb-3.5 text-brand-text">✓</div>
                <h3 className="text-brand-text text-xl font-bold mb-2">Thank you!</h3>
                <p className="text-brand-muted text-sm leading-relaxed">
                  We&apos;ll be in touch within 24 hours with your free audit.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-4">
                  <div>
                    <label htmlFor="contact-first-name" className="block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide">
                      First Name *
                    </label>
                    <input
                      id="contact-first-name"
                      type="text"
                      required
                      value={form.firstName}
                      onChange={(e) => update('firstName', e.target.value)}
                      placeholder="Your first name"
                      className="w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-brand-text text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-last-name" className="block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide">
                      Last Name
                    </label>
                    <input
                      id="contact-last-name"
                      type="text"
                      value={form.lastName}
                      onChange={(e) => update('lastName', e.target.value)}
                      placeholder="Your last name"
                      className="w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-brand-text text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-4">
                  <div>
                    <label htmlFor="contact-email" className="block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide">
                      Email *
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => update('email', e.target.value)}
                      placeholder="you@business.com"
                      className="w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-brand-text text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-phone" className="block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide">
                      Phone Number
                    </label>
                    <input
                      id="contact-phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update('phone', e.target.value)}
                      placeholder="(555) 123-4567"
                      className="w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-brand-text text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-4">
                  <div>
                    <label htmlFor="contact-business" className="block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide">
                      Business Name *
                    </label>
                    <input
                      id="contact-business"
                      type="text"
                      required
                      value={form.business}
                      onChange={(e) => update('business', e.target.value)}
                      placeholder="Your business name"
                      className="w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-brand-text text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-service" className="block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide">
                      What do you need help with?
                    </label>
                    <select
                      id="contact-service"
                      value={form.service}
                      onChange={(e) => update('service', e.target.value)}
                      className="w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-brand-text text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors appearance-auto"
                    >
                      <option value="">Select one...</option>
                      {serviceOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mb-4">
                  <label htmlFor="contact-message" className="block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide">
                    Anything else you&apos;d like us to know?
                  </label>
                  <textarea
                    id="contact-message"
                    value={form.message}
                    onChange={(e) => update('message', e.target.value)}
                    placeholder="Tell us about your business goals, challenges, or questions..."
                    rows={4}
                    className="w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-brand-text text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors resize-y"
                  />
                </div>

                {error && (
                  <div className="text-brand-red text-sm mb-4">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  className="w-full py-3.5 rounded-[10px] mt-2 bg-brand-text text-white text-sm font-bold tracking-wide hover:-translate-y-0.5 hover:bg-neutral-800 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {sending ? 'Sending...' : 'Send & Get My Free Audit'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
