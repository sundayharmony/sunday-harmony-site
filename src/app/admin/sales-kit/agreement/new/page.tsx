'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { packages } from '@/lib/data'

interface FormData {
  client_name: string
  client_email: string
  business_name: string
  business_address: string
  package_tier: string
  package_price: string
  price_type: 'one-time' | 'monthly' | 'custom'
  custom_scope: string
  effective_date: string
}

export default function NewAgreementPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState<FormData>({
    client_name: '',
    client_email: '',
    business_name: '',
    business_address: '',
    package_tier: '',
    package_price: '',
    price_type: 'one-time',
    custom_scope: '',
    effective_date: new Date().toISOString().split('T')[0],
  })

  function handlePackageChange(tier: string) {
    const pkg = packages.find(p => p.tier === tier)
    if (pkg) {
      setFormData(prev => ({
        ...prev,
        package_tier: tier,
        package_price: pkg.price?.toString() || '',
        price_type: pkg.priceSuffix === 'monthly' ? 'monthly' : pkg.priceSuffix === 'one-time' ? 'one-time' : 'custom',
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        package_tier: tier,
      }))
    }
  }

  async function handleSubmit(e: React.FormEvent, action: 'save' | 'send') {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      // Create the document
      const res = await fetch('/api/admin/service-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: 'agreement',
          client_name: formData.client_name,
          client_email: formData.client_email,
          business_name: formData.business_name,
          business_address: formData.business_address,
          package_tier: formData.package_tier,
          package_price: parseFloat(formData.package_price) || 0,
          price_type: formData.price_type,
          custom_scope: formData.custom_scope || undefined,
          effective_date: formData.effective_date,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create agreement')
      }

      const { document } = await res.json()

      // If action is send, also send the email
      if (action === 'send') {
        const sendRes = await fetch(`/api/admin/service-documents/${document.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send' }),
        })

        if (!sendRes.ok) {
          const data = await sendRes.json()
          throw new Error(data.error || 'Failed to send agreement')
        }
      }

      router.push('/admin/sales-kit?tab=documents')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <Link href="/admin/sales-kit" className="text-sm text-brand-muted hover:text-brand-text mb-2 inline-block">
          ← Back to Sales Kit
        </Link>
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">New Service Agreement</h1>
        <p className="text-sm text-brand-muted">
          Fill in the details below. The client will receive a secure link to review and sign.
        </p>
      </div>

      <div className="rounded-xl border border-accent/30 bg-accent-soft/30 p-4 mb-6">
        <p className="text-sm text-brand-muted">
          <strong className="text-brand-text">⚠️ Template notice:</strong> Have an attorney review before use. 
          This document is a starting point, not legal advice.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm mb-6">
          {error}
        </div>
      )}

      <form onSubmit={(e) => handleSubmit(e, 'save')} className="space-y-6">
        {/* Client Information */}
        <section className="rounded-xl border border-brand-border bg-white p-6">
          <h2 className="font-bold text-brand-text mb-4">Client Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">
                Client Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.client_name}
                onChange={(e) => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                className="w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder="John Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">
                Client Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={formData.client_email}
                onChange={(e) => setFormData(prev => ({ ...prev, client_email: e.target.value }))}
                className="w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder="john@business.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">
                Business Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.business_name}
                onChange={(e) => setFormData(prev => ({ ...prev, business_name: e.target.value }))}
                className="w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder="Smith's Auto Repair LLC"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">
                Business Address
              </label>
              <input
                type="text"
                value={formData.business_address}
                onChange={(e) => setFormData(prev => ({ ...prev, business_address: e.target.value }))}
                className="w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder="123 Main St, Egg Harbor Township, NJ"
              />
            </div>
          </div>
        </section>

        {/* Package Selection */}
        <section className="rounded-xl border border-brand-border bg-white p-6">
          <h2 className="font-bold text-brand-text mb-4">Package Selection</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {packages.map((pkg) => (
              <button
                key={pkg.tier}
                type="button"
                onClick={() => handlePackageChange(pkg.tier)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  formData.package_tier === pkg.tier
                    ? 'border-accent bg-accent-soft'
                    : 'border-brand-border hover:border-accent/50'
                }`}
              >
                <div className="text-lg mb-1">{pkg.icon}</div>
                <div className="text-sm font-semibold text-brand-text">{pkg.tier}</div>
                <div className="text-xs text-brand-muted">{pkg.priceLabel || `$${pkg.price}`}</div>
              </button>
            ))}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">
                Package <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.package_tier}
                onChange={(e) => setFormData(prev => ({ ...prev, package_tier: e.target.value }))}
                className="w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">
                Price <span className="text-red-500">*</span>
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 border border-r-0 border-brand-border rounded-l-lg bg-neutral-50 text-brand-muted">$</span>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.package_price}
                  onChange={(e) => setFormData(prev => ({ ...prev, package_price: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-brand-border rounded-r-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">
                Price Type
              </label>
              <select
                value={formData.price_type}
                onChange={(e) => setFormData(prev => ({ ...prev, price_type: e.target.value as 'one-time' | 'monthly' | 'custom' }))}
                className="w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="one-time">One-time</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom/Milestone</option>
              </select>
            </div>
          </div>

          {formData.package_tier === 'Custom Solutions' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-brand-text mb-1">
                Custom Scope Description
              </label>
              <textarea
                value={formData.custom_scope}
                onChange={(e) => setFormData(prev => ({ ...prev, custom_scope: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder="Describe the custom deliverables, quantities, and specifications..."
              />
            </div>
          )}
        </section>

        {/* Dates */}
        <section className="rounded-xl border border-brand-border bg-white p-6">
          <h2 className="font-bold text-brand-text mb-4">Agreement Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">
                Effective Date
              </label>
              <input
                type="date"
                value={formData.effective_date}
                onChange={(e) => setFormData(prev => ({ ...prev, effective_date: e.target.value }))}
                className="w-full px-3 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-4">
          <Link
            href="/admin/sales-kit"
            className="px-6 py-2.5 text-sm font-semibold border border-brand-border rounded-lg hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 text-sm font-semibold border border-brand-border rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save as Draft'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={(e) => handleSubmit(e as unknown as React.FormEvent, 'send')}
            className="px-6 py-2.5 text-sm font-semibold bg-brand-text text-white rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            {saving ? 'Sending...' : 'Save & Send to Client'}
          </button>
        </div>
      </form>
    </div>
  )
}
