import SectionHeader from '@/components/ui/SectionHeader'
import type { PartnerLogo } from '@/lib/partner-logos'

export default function PartnerLogos({ logos }: { logos: PartnerLogo[] }) {
  if (logos.length === 0) return null
  const sliding = logos.length > 1
  const loop = sliding ? [...logos, ...logos] : logos

  return (
    <section className="bg-accent-soft/60 border-y border-brand-border py-20" aria-label="Partners">
      <div className="max-w-[1100px] mx-auto px-7">
        <SectionHeader
          label="Partners"
          title={
            <>
              Businesses we <span className="gold-text">work alongside</span>
            </>
          }
          description="Logos from partners whose profiles are active. The strip keeps moving so each mark gets a turn."
        />
      </div>
      <div className="partner-logo-window mt-12 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
        <ul
          className={sliding ? 'partner-logo-marquee flex w-max gap-6 px-6' : 'flex justify-center px-6'}
          style={sliding ? { animationDuration: `${Math.max(logos.length * 7, 18)}s` } : undefined}
        >
          {loop.map((logo, index) => {
            const duplicate = index >= logos.length
            return (
              <li
                key={`${logo.src}-${index}`}
                aria-hidden={duplicate || undefined}
                className="w-[220px] shrink-0 bg-white border border-brand-border rounded-2xl px-6 py-5 flex flex-col items-center justify-center gap-3"
              >
                {/* Logos are uploaded files, not bundled images. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logo.src}
                  alt={duplicate ? '' : `${logo.companyName} logo`}
                  className="h-16 w-full object-contain"
                />
                <span className="text-xs font-semibold text-brand-text text-center leading-snug">{logo.companyName}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
