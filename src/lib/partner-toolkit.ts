/**
 * Partner-facing toolkit copy.
 *
 * Sources (do not invent pay, prices, eligibility, or extra referral perks):
 * - src/app/credit/page.tsx — personal credit education, intake → analysis → action → track
 * - src/app/funding/page.tsx — business funding education, lender factors, intake steps
 * - src/app/build-fund/page.tsx — two public paths (credit vs funding)
 * - src/lib/referral-qr.ts / CREDIT_INTAKE_PATH — tracked partner links open /credit
 * - src/lib/partner-invite-email.ts — referral link, progress, approval before the link turns on
 * - src/lib/partner-progress.ts — partners are not paid through the client-referrer commission path
 */

export const TOOLKIT_CONTENT_SOURCES = [
  'src/app/credit/page.tsx',
  'src/app/funding/page.tsx',
  'src/app/build-fund/page.tsx',
  'src/lib/credit-intake-routes.ts',
  'src/lib/partner-invite-email.ts',
  'src/lib/partner-progress.ts',
] as const

export const TOOLKIT_SECTIONS = [
  { id: 'credit-repair', label: 'Credit repair' },
  { id: 'business-funding', label: 'Business funding' },
  { id: 'how-they-connect', label: 'How they connect' },
  { id: 'what-to-say', label: 'What to say' },
  { id: 'what-not-to-promise', label: 'What not to promise' },
  { id: 'quick-answers', label: 'Quick answers' },
  { id: 'next-step', label: 'Next step' },
] as const

export const TOOLKIT_INTRO = {
  kicker: 'Partner toolkit',
  title: 'Simple words for credit and funding.',
  lead: 'This page is for partners. It uses short sentences on purpose. Share only what is true. Do not promise a score, an approval, a dollar amount, or a date.',
  banner: 'Sunday Harmony reviews files and helps with the next step. Lenders decide funding. The law limits what credit repair can do.',
}

export const TOOLKIT_DEFINITIONS = [
  {
    id: 'personal-credit',
    title: 'Personal credit',
    meaning: 'This is one person’s borrowing history.',
    detail: 'It lives on consumer reports at the three credit bureaus.',
    not: 'It is not the company’s borrowing history.',
  },
  {
    id: 'business-credit',
    title: 'Business credit',
    meaning: 'This is a company’s borrowing history.',
    detail: 'Lenders also look at revenue, time in business, and debt.',
    not: 'It is not the same file as the owner’s personal credit.',
  },
  {
    id: 'personal-guarantee',
    title: 'Personal guarantee',
    meaning: 'You may have to repay personally if the business cannot.',
    detail: 'Some business products ask for this. Some do not.',
    not: 'Better personal credit does not take this risk away.',
  },
] as const

export const CREDIT_REPAIR_STEPS = [
  {
    title: 'Secure intake',
    body: 'The client shares identity, goals, and monitoring access. This is their form, not yours.',
  },
  {
    title: 'Review the reports',
    body: 'Sunday Harmony maps scores, negatives, and inquiries across the three bureaus. They look for possible errors.',
  },
  {
    title: 'Take action',
    body: 'They dispute inaccurate or unverifiable items through the proper process. They also plan paydown and good habits.',
  },
  {
    title: 'Track progress',
    body: 'The client portal shows rounds and next steps as the file changes. Results depend on the file and how companies respond.',
  },
] as const

export const CREDIT_REPAIR_LIMITS = [
  'Accurate, current negative information cannot simply be removed.',
  'A dispute is not a promise that an item will come off.',
  'No one can promise a higher score.',
] as const

export const FUNDING_STEPS = [
  {
    title: 'Share the business',
    body: 'Contact details, the amount, and a short business profile. This form does not ask for a Social Security number.',
  },
  {
    title: 'Review the file',
    body: 'Sunday Harmony reads the details and flags what is missing. This is not a loan application.',
  },
  {
    title: 'Close the gaps',
    body: 'Sort the documents and fixes that strengthen the request. Uploads can wait if they are not ready.',
  },
  {
    title: 'Choose the next step',
    body: 'Talk through options that fit. Nothing is promised up front. Lenders decide.',
  },
] as const

export const FUNDING_LENDER_LOOKS_AT = [
  {
    title: 'Time in business',
    body: 'How long the doors have been open changes which programs are realistic.',
  },
  {
    title: 'Revenue and cash flow',
    body: 'Deposits and bank statements show whether the business can carry new capital.',
  },
  {
    title: 'What the money is for',
    body: 'Equipment, payroll, inventory, and expansion are reviewed differently.',
  },
  {
    title: 'The owner profile',
    body: 'Many small-business programs also look at the owner. That is a separate step from the business intake.',
  },
] as const

export const FUNDING_OPTIONS = [
  {
    title: 'Term loan',
    body: 'A lump sum repaid on a fixed schedule.',
  },
  {
    title: 'Line of credit',
    body: 'Draw what you need, repay, and draw again.',
  },
  {
    title: 'Equipment financing',
    body: 'The equipment itself secures the loan.',
  },
  {
    title: 'SBA-backed loan',
    body: 'Partly backed by the government for the lender, with more paperwork. That is not a personal guarantee, and it is not a promise of approval.',
  },
  {
    title: 'Working capital advance',
    body: 'Repaid from future sales. Often faster. Usually costs more.',
  },
] as const

export const CONNECTION_POINTS = [
  {
    title: 'They are different files',
    body: 'Personal credit is the person. Business credit is the company.',
  },
  {
    title: 'A personal guarantee is extra risk',
    body: 'If the business cannot pay, the person may have to pay.',
  },
  {
    title: 'Stronger personal credit may help a review',
    body: 'That is only when a lender uses a personal guarantee. It still does not guarantee funding.',
  },
  {
    title: 'Lenders look at more than credit',
    body: 'They also weigh revenue, time in business, existing debt, and their own rules.',
  },
  {
    title: 'Not every product needs repair or a personal guarantee',
    body: 'Some products look at the business. Some look at the owner. Ask before you assume.',
  },
] as const

export const WHO_DOES_WHAT = [
  {
    title: 'You, the partner',
    body: 'Share your referral link. Use simple, true words. Do not promise results. Do not submit the form for them.',
  },
  {
    title: 'The client',
    body: 'Completes their own intake. Shares access and documents. Stays in the client portal for updates.',
  },
  {
    title: 'Sunday Harmony',
    body: 'Reviews the file. Disputes inaccurate or unverifiable items. Helps plan the next step.',
  },
  {
    title: 'The lender',
    body: 'Decides funding. Uses its own rules. Sunday Harmony is not the lender.',
  },
] as const

export const TALKING_POINTS = [
  {
    id: 'review-dispute',
    label: 'What credit repair does',
    text: 'Sunday Harmony reviews credit reports and disputes items that are inaccurate or cannot be verified.',
  },
  {
    id: 'accurate-stays',
    label: 'What it cannot wipe away',
    text: 'If a negative item is accurate and current, it cannot simply be removed.',
  },
  {
    id: 'no-promises',
    label: 'No promises',
    text: 'No one can promise a score, an approval, a dollar amount, or a date.',
  },
  {
    id: 'two-files',
    label: 'Two kinds of credit',
    text: 'Personal credit is your own borrowing history. Business credit is the company’s borrowing history. They are not the same.',
  },
  {
    id: 'guarantee-means',
    label: 'Personal guarantee',
    text: 'A personal guarantee means you may have to repay a business loan yourself if the business cannot.',
  },
  {
    id: 'may-help',
    label: 'How they connect',
    text: 'Stronger personal credit may help a lender review products that use a personal guarantee. It does not remove that risk. It does not guarantee funding.',
  },
  {
    id: 'lenders-also',
    label: 'What lenders also check',
    text: 'Lenders also look at revenue, time in business, existing debt, and their own rules.',
  },
  {
    id: 'how-to-refer',
    label: 'How to refer',
    text: 'If someone wants help, share your Sunday Harmony referral link. They complete their own intake.',
  },
] as const

export const WHAT_NOT_TO_PROMISE = [
  {
    title: 'A higher score',
    body: 'Scores can move up or down. Nobody can lock in a number.',
  },
  {
    title: 'Deleting accurate items',
    body: 'True, current negatives stay. Disputes are for inaccurate or unverifiable information.',
  },
  {
    title: 'Loan approval',
    body: 'Lenders decide. Sunday Harmony does not approve loans.',
  },
  {
    title: 'A dollar amount',
    body: 'Do not guess how much funding a person or business will get.',
  },
  {
    title: 'A timeline',
    body: 'Do not pick a number of days or months for a result.',
  },
  {
    title: 'That a personal guarantee goes away',
    body: 'Better personal credit does not cancel personal liability.',
  },
] as const

export const TOOLKIT_FAQS = [
  {
    q: 'Can you promise a higher score?',
    a: 'No. Sunday Harmony follows the law and disputes inaccurate or unverifiable items. Results depend on the file and how furnishers respond.',
  },
  {
    q: 'Can you wipe anything the client dislikes?',
    a: 'No. Accurate, current information stays. Only inaccurate or unverifiable items can be disputed the right way.',
  },
  {
    q: 'Does better personal credit mean the business will get money?',
    a: 'No. Lenders decide. They look at more than credit. Not every product needs credit repair or a personal guarantee.',
  },
  {
    q: 'Does a stronger score cancel a personal guarantee?',
    a: 'No. You may still have to repay personally if the business cannot.',
  },
  {
    q: 'What do I send people?',
    a: 'Your referral link on the Dashboard. After Sunday Harmony approves your account, that link opens the personal credit intake. The person submits their own form.',
  },
  {
    q: 'Is the funding form the same as credit repair?',
    a: 'No. Funding is a different public page. Your tracked partner link is for the credit intake.',
  },
] as const

export const SHAREABLE_RESOURCES = [
  {
    id: 'referral-dashboard',
    title: 'Your referral link and QR',
    href: '/partner',
    note: 'On the Dashboard tab. Share the link. Do not submit the form for them. The link stays off until Sunday Harmony approves your account.',
  },
  {
    id: 'credit-page',
    title: 'Personal credit page',
    href: '/credit',
    note: 'Public education. This is the intake path your tracked partner link uses.',
  },
  {
    id: 'funding-page',
    title: 'Business funding page',
    href: '/funding',
    note: 'Public education and a separate business intake. It is not your tracked partner link.',
  },
  {
    id: 'build-fund',
    title: 'Build & Fund overview',
    href: '/build-fund',
    note: 'A simple public choice between personal credit and business funding.',
  },
] as const

export const TOOLKIT_UNAVAILABLE_FACTS = [
  'This page does not list partner pay, prices, or special eligibility.',
  'Use only what Sunday Harmony has given you in writing.',
] as const

export function collectToolkitPlainText(): string {
  return [
    TOOLKIT_INTRO.kicker,
    TOOLKIT_INTRO.title,
    TOOLKIT_INTRO.lead,
    TOOLKIT_INTRO.banner,
    ...TOOLKIT_DEFINITIONS.flatMap((item) => [item.title, item.meaning, item.detail, item.not]),
    ...CREDIT_REPAIR_STEPS.flatMap((item) => [item.title, item.body]),
    ...CREDIT_REPAIR_LIMITS,
    ...FUNDING_STEPS.flatMap((item) => [item.title, item.body]),
    ...FUNDING_LENDER_LOOKS_AT.flatMap((item) => [item.title, item.body]),
    ...FUNDING_OPTIONS.flatMap((item) => [item.title, item.body]),
    ...CONNECTION_POINTS.flatMap((item) => [item.title, item.body]),
    ...WHO_DOES_WHAT.flatMap((item) => [item.title, item.body]),
    ...TALKING_POINTS.flatMap((item) => [item.label, item.text]),
    ...WHAT_NOT_TO_PROMISE.flatMap((item) => [item.title, item.body]),
    ...TOOLKIT_FAQS.flatMap((item) => [item.q, item.a]),
    ...SHAREABLE_RESOURCES.flatMap((item) => [item.title, item.href, item.note]),
    ...TOOLKIT_UNAVAILABLE_FACTS,
  ].join('\n')
}
