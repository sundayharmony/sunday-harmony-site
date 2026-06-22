'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import StatCard from '@/components/ui/StatCard'
import type { CrmReportMetrics } from '@/lib/crm-db'

export default function CrmReportsPage() {
  const [metrics, setMetrics] = useState<CrmReportMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/reports/crm')
      .then((r) => r.json())
      .then(setMetrics)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="p-8 text-center text-brand-dim">Loading reports...</div>
  }

  if (!metrics) {
    return <div className="p-8 text-center text-red-600">Failed to load CRM reports.</div>
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">CRM Reports</h1>
          <p className="text-sm text-brand-muted">Pipeline metrics and conversion analytics.</p>
        </div>
        <Link href="/admin/crm" className="text-xs text-accent hover:underline">← CRM Overview</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Marketing Leads" value={metrics.total_marketing_leads} />
        <StatCard label="Credit Repair Apps" value={metrics.credit_repair_apps} color="accent" />
        <StatCard label="Funding Apps" value={metrics.funding_apps} />
        <StatCard label="Business Funding Apps" value={metrics.business_funding_apps} />
        <StatCard label="Consultations Scheduled" value={metrics.consultations_scheduled} />
        <StatCard label="Consultations Completed" value={metrics.consultations_completed} />
        <StatCard label="Conversion Rate" value={`${metrics.conversion_rate}%`} />
        <StatCard label="Active Clients" value={metrics.active_clients} />
        <StatCard label="Completed Clients" value={metrics.completed_clients} />
        <StatCard label="Funding Requests" value={metrics.funding_requests} />
        <StatCard label="Est. Pipeline" value={metrics.estimated_pipeline} color="gold" />
        <StatCard label="Pending Applications" value={metrics.pending_applications} />
      </div>

      <div className="bg-white border border-brand-border rounded-xl p-6 shadow-sm">
        <h2 className="text-sm font-bold text-brand-text mb-4">Summary</h2>
        <p className="text-sm text-brand-muted leading-relaxed">
          Your CRM pipeline includes {metrics.total_marketing_leads} marketing leads with a{' '}
          {metrics.conversion_rate}% conversion rate. {metrics.funding_requests} funding requests are on file
          with an estimated pipeline value of {metrics.estimated_pipeline}.{' '}
          {metrics.consultations_scheduled} consultations are scheduled and {metrics.consultations_completed} have been completed.
        </p>
      </div>
    </div>
  )
}
