import Link from 'next/link'
import BrandLogo from '@/components/BrandLogo'
import { siteConfig } from '@/lib/data'
import { siteFooterExtraLinks, siteNavLinks } from '@/lib/navigation'

export default function Footer() {
  return (
    <footer className="py-12 pb-8 border-t border-brand-border bg-brand-bg-soft">
      <div className="max-w-[1100px] mx-auto px-7">
        <div className="flex justify-between items-center flex-wrap gap-5">
          <BrandLogo height={34} href="/" />
          <div className="flex gap-7 flex-wrap">
            {siteNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[13px] text-brand-dim hover:text-brand-text transition-colors"
              >
                {link.label}
              </Link>
            ))}
            {siteFooterExtraLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[13px] text-brand-dim hover:text-brand-text transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="text-center mt-8 pt-6 border-t border-brand-border text-xs text-brand-dim">
          &copy; {new Date().getFullYear()} Sunday Harmony. All rights reserved. &bull; {siteConfig.tagline}
        </div>
      </div>
    </footer>
  )
}
