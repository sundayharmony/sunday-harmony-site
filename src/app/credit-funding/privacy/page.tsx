import type { Metadata } from 'next'
import Link from 'next/link'
import PublicPageLayout from '@/components/layout/PublicPageLayout'

export const metadata: Metadata = {
  title: 'Privacy Policy | Credit & Funding',
  description:
    'Privacy policy for Sunday Harmony Credit & Funding services — how we collect, use, and protect your information.',
  alternates: { canonical: '/credit-funding/privacy' },
  openGraph: {
    title: 'Privacy Policy | Credit & Funding | Sunday Harmony',
    description:
      'Privacy policy for Sunday Harmony Credit & Funding services — how we collect, use, and protect your information.',
    url: '/credit-funding/privacy',
  },
}

const sections = [
  {
    title: '1. Information We Collect',
    content: [
      'Personal identification information including full legal name, date of birth, government-issued ID, and proof of address.',
      'Contact information including email address, phone number, and mailing address.',
      'Financial information including income, funding goals, credit profile data, and business revenue where applicable.',
      'Business information including legal entity name, EIN, industry, entity type, and business credit profile when you apply for business funding.',
      'Uploaded documents such as photo ID, proof of address, mail verification, bank statements, tax returns, and other supporting materials.',
      'Credit monitoring credentials (username and password) for authorized third-party credit report providers you select.',
    ],
  },
  {
    title: '2. How Information Is Used',
    content: [
      'Credit analysis and repair services to evaluate your credit profile and develop improvement strategies.',
      'Funding qualification to assess eligibility for personal and business funding programs.',
      'Communications regarding your application status, requested documents, and next steps.',
      'Compliance with applicable laws, regulations, and identity verification requirements.',
      'Internal reporting and quality assurance to improve our services.',
    ],
  },
  {
    title: '3. Data Security',
    content: [
      'Encryption at rest (AES-256-GCM) for date of birth, home address, phone, income, typed signature, EIN, business contact details, and credit monitoring credentials.',
      'Encryption in transit via HTTPS for all form submissions and file uploads.',
      'Role-based access controls (RBAC) limiting staff access to applicant data on a need-to-know basis.',
      'Secure private cloud storage for uploaded documents with signed URL access only.',
      'Server-signed upload sessions and file validation (type, size, and content checks) before documents are stored.',
      'Audit logging of administrative access and status changes to your application.',
    ],
  },
  {
    title: '4. Third-Party Services',
    content: [
      'Credit monitoring providers (e.g., IdentityIQ, Credit Hero Score, SmartCredit) that you authorize us to access on your behalf.',
      'Email delivery services for application confirmations and status updates.',
      'Cloud storage providers for secure document hosting.',
      'Payment processors when applicable for service fees.',
      'We do not sell your personal information to third parties.',
    ],
  },
  {
    title: '5. Your Rights',
    content: [
      'Access: You may request a copy of the personal information we hold about you.',
      'Corrections: You may request correction of inaccurate information in your application.',
      'Deletion: You may request deletion of your data, subject to legal retention requirements.',
      'Withdraw consent: You may withdraw consent for credit review at any time by contacting us, though this may affect our ability to provide services.',
    ],
  },
  {
    title: '6. Document Retention Policy',
    content: [
      'Application data and uploaded documents are retained for the duration of your engagement plus up to seven (7) years thereafter for compliance and audit purposes.',
      'Encrypted credentials are deleted or rotated upon completion of services or upon your written request.',
      'You may request earlier deletion where permitted by law; some records may be retained as required by regulatory obligations.',
    ],
  },
  {
    title: '7. Contact Information',
    content: [
      'Sunday Harmony L.L.C.',
      'Email: sales@sundayharmony.com',
      'Website: sundayharmony.com',
      'For privacy-related requests, please include your Application ID and full name in your correspondence.',
    ],
  },
  {
    title: '8. Marketing Website',
    content: [
      'The public Sunday Harmony website contact form collects your name, email, phone, business name, and message so we can respond to inquiries.',
      'Contact submissions may be stored as leads in our CRM and emailed to our team. We do not sell this information.',
      'The same access, correction, and deletion rights in section 5 apply to marketing inquiries. Email sales@sundayharmony.com to make a request.',
    ],
  },
]

export default function CreditFundingPrivacyPage() {
  return (
    <PublicPageLayout
      maxWidthClass="max-w-[800px]"
      label="Credit & Funding"
      title="Privacy Policy"
      minimalHeader
      hero={
        <>
          <Link href="/credit-funding" className="text-sm text-accent hover:underline mb-6 inline-block">
            ← Back to Application
          </Link>
          <p className="text-sm text-brand-dim mb-10">
            Last updated: August 26, 2026
          </p>
        </>
      }
    >
      <div className="bg-white border border-brand-border rounded-2xl shadow-sm p-6 sm:p-8 space-y-8">
        <p className="text-[15px] text-brand-muted leading-relaxed">
          Sunday Harmony (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy.
          This policy describes how we collect, use, store, and safeguard information submitted through our
          Credit &amp; Funding application portal and the Sunday Harmony marketing website.
        </p>

        {sections.map((section) => (
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
