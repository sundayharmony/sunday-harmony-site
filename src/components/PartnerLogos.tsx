import SectionHeader from '@/components/ui/SectionHeader'
import type { PartnerLogo } from '@/lib/partner-logos'

export default function PartnerLogos({ logos }: { logos: PartnerLogo[] }) {
  if (logos.length === 0) return null

  return (
    <section className="bg-accent-soft/60 border-y border-brand-border py-20" aria-label="Case studies">
      <div className="max-w-[1100px] mx-auto px-7">
        <SectionHeader
          label="Case studies"
          title={
            <>
              Businesses we <span className="gold-text">work alongside</span>
            </>
          }
          description="Company names, logos, and short notes from the Case Study tab."
        />
        <ul className="case-study-grid mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {logos.map((logo) => (
            <li
              key={`${logo.companyName}-${logo.src || 'note'}`}
              className="bg-white border border-brand-border rounded-2xl px-6 py-5 flex flex-col items-center text-center gap-3"
            >
              {logo.src ? (
                // Logos are uploaded files, not bundled images.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo.src}
                  alt={`${logo.companyName} logo`}
                  className="h-16 w-full object-contain"
                />
              ) : (
                <div className="h-16 w-full flex items-center justify-center text-sm font-semibold text-brand-dim">
                  {logo.companyName.slice(0, 1)}
                </div>
              )}
              <span className="text-sm font-semibold text-brand-text leading-snug">{logo.companyName}</span>
              {logo.blurb ? (
                <p className="text-sm text-brand-muted leading-relaxed whitespace-pre-wrap">{logo.blurb}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
