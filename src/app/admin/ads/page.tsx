'use client'

import { useMemo, useState } from 'react'
import AdPreviewCard from '@/components/admin/campaign-ads/AdPreviewCard'
import {
  adOffer,
  adsForLayout,
  adsForOffer,
  adsForSource,
  campaignAds,
  formatCampaignAdText,
  type AdLayout,
} from '@/lib/campaign-ads'

type Filter = 'all' | 'live' | 'new' | 'marketing' | 'credit' | AdLayout

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All ads' },
  { key: 'live', label: 'On the site now' },
  { key: 'new', label: 'New variations' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'credit', label: 'Credit analysis' },
  { key: 'heroQuote', label: 'Hero' },
  { key: 'ctaBlock', label: 'CTA' },
  { key: 'serviceSpotlight', label: 'Services' },
  { key: 'packagePromo', label: 'Packages' },
  { key: 'statProof', label: 'Proof' },
  { key: 'search', label: 'Google' },
  { key: 'social', label: 'Social' },
]

export default function CampaignAdsPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const [copied, setCopied] = useState<string | null>(null)

  const ads = useMemo(() => {
    if (filter === 'all') return campaignAds
    if (filter === 'live' || filter === 'new') return adsForSource(filter)
    if (filter === 'marketing' || filter === 'credit') return adsForOffer(filter)
    return adsForLayout(filter)
  }, [filter])

  const copy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 2000)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Campaign Ads</h1>
        <p className="text-sm text-brand-muted max-w-2xl">
          Homepage-style creatives for the free marketing audit and the free credit analysis.
          Copy any ad for Meta, Google, Instagram, LinkedIn, or a walk-in card.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === item.key
                ? 'bg-accent-soft border border-accent text-accent'
                : 'bg-gray-50 border border-brand-border text-brand-muted'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-brand-dim mb-4">
        {ads.length} ad{ads.length === 1 ? '' : 's'}
        {filter === 'all' ? ` · ${adsForSource('new').length} new variations` : ''}
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {ads.map((ad) => (
          <article key={ad.id} className="bg-white border border-brand-border rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="text-sm font-bold text-brand-text">{ad.label}</h2>
                <p className="text-[11px] text-brand-dim mt-0.5">
                  {ad.source === 'live' ? 'Live on the site' : 'New variation'} ·{' '}
                  {adOffer(ad) === 'credit' ? 'Credit analysis' : 'Marketing'} · {layoutLabel(ad.layout)} ·{' '}
                  {ad.channels.join(', ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copy(ad.id, formatCampaignAdText(ad))}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-accent-soft border border-accent text-xs font-semibold text-accent hover:bg-neutral-100 transition-all"
              >
                {copied === ad.id ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
            <AdPreviewCard ad={ad} />
          </article>
        ))}
      </div>
    </div>
  )
}

function layoutLabel(layout: AdLayout): string {
  return (
    {
      heroQuote: 'Hero',
      ctaBlock: 'CTA',
      serviceSpotlight: 'Service',
      packagePromo: 'Package',
      statProof: 'Proof',
      search: 'Google search',
      social: 'Social',
    } satisfies Record<AdLayout, string>
  )[layout]
}
