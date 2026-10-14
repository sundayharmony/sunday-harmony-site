import type { Metadata } from 'next'
import Link from 'next/link'
import PublicPageLayout from '@/components/layout/PublicPageLayout'
import { CREDIT_INTAKE_PATH, CREDIT_PRIVACY_PATH } from '@/lib/credit-intake-routes'
import { creditPrivacySections } from '@/lib/credit-privacy-sections'

export const metadata: Metadata = {
  title: 'Privacy Policy | Personal Credit',
  description:
    'Privacy policy for Sunday Harmony personal credit services — how we collect, use, and protect your information.',
  alternates: { canonical: CREDIT_PRIVACY_PATH },
  openGraph: {
    title: 'Privacy Policy | Personal Credit | Sunday Harmony',
    description:
      'Privacy policy for Sunday Harmony personal credit services — how we collect, use, and protect your information.',
    url: CREDIT_PRIVACY_PATH,
  },
}

export default function CreditPrivacyPage() {
  return (
    <PublicPageLayout
      maxWidthClass="max-w-[800px]"
      label="Personal credit"
      title="Privacy Policy"
      minimalHeader
      hero={
        <>
          <Link href={CREDIT_INTAKE_PATH} className="text-sm text-accent hover:underline mb-6 inline-block">
            ← Back to intake
          </Link>
          <p className="text-sm text-brand-dim mb-10">Last updated: August 26, 2026</p>
        </>
      }
    >
      <div className="bg-white border border-brand-border rounded-2xl shadow-sm p-6 sm:p-8 space-y-8">
        <p className="text-[15px] text-brand-muted leading-relaxed">
          Sunday Harmony (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy.
          This policy describes how we collect, use, store, and safeguard information submitted through our
          personal credit intake and the Sunday Harmony marketing website.
        </p>

        {creditPrivacySections.map((section) => (
          <div key={section.title}>
            <h2 className="font-serif text-lg font-bold text-brand-text mb-3">{section.title}</h2>
            <ul className="space-y-2">
              {section.content.map((item) => (
                <li key={item} className="text-sm text-brand-muted leading-relaxed flex gap-2">
                  <span className="text-accent mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </PublicPageLayout>
  )
}
