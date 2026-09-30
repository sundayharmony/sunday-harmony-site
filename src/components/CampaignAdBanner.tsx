import AuditCtaButton from '@/components/ui/AuditCtaButton'
import { adCtaHref, type CampaignAd } from '@/lib/campaign-ads'

export default function CampaignAdBanner({ ad }: { ad: CampaignAd }) {
  return (
    <section className="py-24 pt-0" data-campaign-ad={ad.id}>
      <div className="max-w-[1100px] mx-auto px-7">
        <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 border border-brand-border rounded-3xl py-16 px-6 sm:px-10 lg:px-14 text-center relative overflow-hidden">
          <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(0,0,0,0.04)_0%,transparent_60%)] pointer-events-none" />
          {ad.badge && (
            <p className="relative text-xs uppercase tracking-[0.2em] text-brand-dim mb-4">{ad.badge}</p>
          )}
          <h2 className="font-serif text-[clamp(28px,4vw,42px)] font-extrabold text-brand-text mb-4 relative">
            {ad.headline}{' '}
            {ad.accentPhrase && (
              <em className="font-serif not-italic text-accent">{ad.accentPhrase}</em>
            )}
          </h2>
          <p className="text-[17px] text-brand-muted mb-9 max-w-[540px] mx-auto relative">{ad.body}</p>
          <AuditCtaButton
            variant="primary"
            href={adCtaHref(ad)}
            label={ad.ctaLabel}
            className="relative"
          />
        </div>
      </div>
    </section>
  )
}
