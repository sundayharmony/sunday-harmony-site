import type { CampaignAd } from '@/lib/campaign-ads'

export default function AdPreviewCard({ ad }: { ad: CampaignAd }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-brand-border bg-gradient-to-br from-white via-neutral-50 to-neutral-100 p-6 min-h-[240px] flex flex-col"
      data-ad-preview={ad.id}
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />
      <div className="relative z-10 flex flex-1 flex-col">
        {ad.layout === 'search' ? (
          <SearchPreview ad={ad} />
        ) : ad.layout === 'statProof' ? (
          <StatPreview ad={ad} />
        ) : ad.layout === 'packagePromo' ? (
          <PackagePreview ad={ad} />
        ) : ad.layout === 'serviceSpotlight' ? (
          <ServicePreview ad={ad} />
        ) : (
          <QuotePreview ad={ad} centered={ad.layout === 'ctaBlock' || ad.layout === 'social'} />
        )}
      </div>
    </div>
  )
}

function QuotePreview({ ad, centered }: { ad: CampaignAd; centered: boolean }) {
  return (
    <div className={`flex flex-1 flex-col justify-between ${centered ? 'items-center text-center' : ''}`}>
      {ad.badge && (
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-soft border border-brand-border text-[10px] font-semibold text-accent tracking-wide mb-4">
          {ad.badge}
        </div>
      )}
      <div className={centered ? 'max-w-[92%]' : ''}>
        <h3 className="font-serif text-[28px] font-extrabold leading-[1.1] text-brand-text">
          {ad.headline}
          {ad.accentPhrase ? (
            centered ? (
              <>
                {' '}
                <span className="italic text-accent">{ad.accentPhrase}</span>
              </>
            ) : (
              <span className="mt-1 block italic text-accent">{ad.accentPhrase}</span>
            )
          ) : null}
        </h3>
        <p className="mt-4 text-sm text-brand-muted leading-relaxed">{ad.body}</p>
      </div>
      <div className="mt-6">
        <span className="inline-flex items-center px-4 py-2 rounded-lg bg-brand-text text-white text-xs font-semibold">
          {ad.ctaLabel}
        </span>
        {ad.footer && <p className="mt-3 text-[11px] text-brand-dim">{ad.footer}</p>}
      </div>
    </div>
  )
}

function ServicePreview({ ad }: { ad: CampaignAd }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="w-11 h-11 rounded-xl bg-accent-soft border border-brand-border flex items-center justify-center text-xl mb-4">
        {ad.icon}
      </div>
      <h3 className="text-lg font-extrabold text-brand-text mb-2">{ad.headline}</h3>
      <p className="text-sm text-brand-muted leading-relaxed flex-1">{ad.body}</p>
      <span className="mt-5 inline-flex self-start items-center px-4 py-2 rounded-lg bg-brand-text text-white text-xs font-semibold">
        {ad.ctaLabel}
      </span>
    </div>
  )
}

function PackagePreview({ ad }: { ad: CampaignAd }) {
  return (
    <div className="flex flex-1 flex-col text-center items-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-dim">{ad.tier}</p>
      <p className="font-serif text-3xl font-extrabold text-brand-text mt-2">{ad.price}</p>
      <p className="italic text-accent font-semibold mt-1">{ad.headline}</p>
      <p className="mt-4 text-sm text-brand-muted leading-relaxed">{ad.body}</p>
      <span className="mt-5 inline-flex items-center px-4 py-2 rounded-lg bg-brand-text text-white text-xs font-semibold">
        {ad.ctaLabel}
      </span>
    </div>
  )
}

function StatPreview({ ad }: { ad: CampaignAd }) {
  return (
    <div className="flex flex-1 flex-col">
      <h3 className="font-serif text-2xl font-extrabold text-brand-text mb-4">{ad.headline}</h3>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {(ad.stats ?? []).map((stat) => (
          <div key={stat.label}>
            <div className="font-serif text-2xl font-extrabold text-brand-text">{stat.value}</div>
            <div className="text-[10px] text-brand-dim tracking-wide">{stat.label}</div>
          </div>
        ))}
      </div>
      <p className="text-sm text-brand-muted leading-relaxed flex-1">{ad.body}</p>
      <span className="mt-5 inline-flex self-start items-center px-4 py-2 rounded-lg bg-brand-text text-white text-xs font-semibold">
        {ad.ctaLabel}
      </span>
    </div>
  )
}

function SearchPreview({ ad }: { ad: CampaignAd }) {
  return (
    <div className="bg-white border border-brand-border rounded-xl p-4 text-left">
      <p className="text-[11px] text-green-700 truncate">{ad.footer}</p>
      <h3 className="text-[#1a0dab] text-lg font-medium leading-snug mt-0.5">{ad.headline}</h3>
      <p className="text-sm text-brand-muted mt-1 leading-relaxed">{ad.body}</p>
      <p className="mt-3 text-[11px] font-semibold text-brand-text">{ad.ctaLabel}</p>
    </div>
  )
}
