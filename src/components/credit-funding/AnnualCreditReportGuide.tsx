import { ANNUAL_CREDIT_REPORT_URL } from '@/lib/credit-funding-types'

export default function AnnualCreditReportGuide() {
  return (
    <div className="mb-6 p-4 rounded-xl border border-brand-border bg-neutral-50">
      <h4 className="text-sm font-bold text-brand-text">Download your free 3-bureau credit report</h4>
      <p className="mt-1.5 text-sm text-brand-muted leading-relaxed">
        Use the official Annual Credit Report site to get Equifax, Experian, and TransUnion in one
        request, then upload the PDF on this form. Do not use lookalike paid sites.
      </p>
      <ol className="mt-3 space-y-1.5 text-sm text-brand-muted list-decimal pl-5 leading-relaxed">
        <li>Open AnnualCreditReport.com and start a report request.</li>
        <li>Select Equifax, Experian, and TransUnion (all three bureaus).</li>
        <li>Complete identity verification, then download the report as a PDF.</li>
        <li>Upload that PDF in the 3-bureau credit report box below.</li>
      </ol>
      <a
        href={ANNUAL_CREDIT_REPORT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-brand-text text-white text-sm font-semibold hover:bg-neutral-800"
      >
        Open AnnualCreditReport.com
        <span aria-hidden="true">↗</span>
      </a>
    </div>
  )
}
