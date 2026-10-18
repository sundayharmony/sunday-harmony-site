---
name: CRM People System
overview: "Replace the separate Consultations, Credit & Funding, Clients, Billing, Referrals, Tasks, and Messages admin tabs with one person file. Today is the work queue. Partners stays its own tab. Credit managers only see credit and funding people."
todos:
  - id: person-resolver
    content: Resolve one person by normalized email across leads, clients, applications, and consultation bookings, and link matching rows.
    status: pending
  - id: people-list
    content: Replace the CRM contact list with /admin/people, one row per person, with credit-manager filtering.
    status: pending
  - id: person-file
    content: Build the person file with consultation, credit and funding, client package, billing, referrals, tasks, and messages.
    status: pending
  - id: today-queue
    content: Turn the admin overview into Today — upcoming consultations, applications waiting, who owes money, and referral payouts ready.
    status: pending
  - id: nav-redirects
    content: Shrink the sidebar, move booking hours into Settings, and permanently redirect the old tabs.
    status: pending
isProject: false
---

# CRM People System

One email is one person. Consultations, credit and funding, the client package, billing, referrals, tasks, and messages live on that person’s file. The owner’s daily sidebar is **Today**, **People**, and **Partners**. Settings stays available. Market research, the package catalog, the 90-day roadmap, and sales training stay as reference pages, off the daily path.

Credit managers keep a narrower door. Their People list is only people with credit or funding work. The file they open shows the application, documents, letters, funding assessment, credit tasks, credit messages, and the one-time repair fee. Marketing package, marketing subscription, and marketing-only people stay hidden.

## What stays where

| Job today | After |
| --- | --- |
| `/admin` overview | **Today**: upcoming consultations, applications waiting on review, who owes money, referral payouts ready |
| `/admin/crm` and `/admin/contacts/...` | **People** and `/admin/people/[id]` |
| `/admin/consultations` bookings | The person’s Consultation section, and Today |
| Consultation hours and blackouts | **Settings**, so the public `/book` page still has hours |
| `/admin/credit-funding` | The person’s Credit & Funding section. Letter writing stays the existing dispute-letters workspace, opened from that section |
| `/admin/clients` package, deliverables, portal | The person’s Client section |
| `/admin/billing` | The person’s Billing section (monthly plan and one-time repair fee). Collections only appear on Today |
| `/admin/referrals` | That client’s Referral section. Payouts that are ready also show on Today |
| `/admin/tasks` | That person’s Tasks section |
| `/admin/messages` | That person’s Messages section |
| `/admin/partners` | Unchanged. A partner is not a client |
| `/admin/settings` | Unchanged, plus booking hours |
| Research, packages, roadmap, training | Unchanged routes, removed from the daily sidebar |

Public `/book`, credit intake, the client portal, and the partner portal do not change in this plan. They keep writing the same records. The admin just stops showing those records as separate lists.

## Identity

Do not add a new people table. A person is a view over the rows that already exist:

- `leads` (contact form, consultation booking, credit intake)
- `clients` (portal account, package, Stripe, repair fee)
- `credit_funding_applications` (matched by email, `client_id`, or `lead_id`)
- `consultation_bookings.guest_email` and `lead_id`
- meetings, tasks, messages, and referral profiles already hang off `client_id` or `lead_id`

`getCrmContacts` in `src/lib/crm-db.ts` currently emits a lead row and a client row unless `lead.client_id` is set. A consultation and a later credit intake for the same email can therefore be two people. The new resolver collapses them.

`resolvePeople()` groups by normalized email. The canonical id is the client id when a client exists, otherwise the oldest lead id. Rows with no email stay as their own person (keyed by lead or client id) so nothing disappears.

When a match is found, write the links that already exist on the rows:

- `leads.client_id` and `clients.lead_id`
- `credit_funding_applications.lead_id` and `client_id`
- `consultation_bookings.lead_id`

Do this at read time for the admin file, and at write time in `bookConsultation` (`src/lib/consultation-service.ts`) and `upsertLeadFromCreditIntake` (`src/lib/crm-db.ts`). Intake already updates a lead with the same email. Booking already creates a lead and stores `lead_id` on the booking. The missing step is “find the existing lead or client with this email before inserting another lead.”

## Person file

Route: `/admin/people/[id]`.

Owner sections, in this order, each omitted when that person has nothing there yet:

1. **Header** — name, business, email, phone, lead type.
2. **Consultation** — upcoming booking, Meet link, cancel. Staff can still schedule a meeting the way the contact page does today.
3. **Credit & Funding** — application status, documents, and the actions that already live on `src/app/admin/credit-funding/page.tsx`. Open dispute letters in the existing `/admin/dispute-letters/[sessionId]` workspace. Do not rewrite letter generation.
4. **Client** — package, deliverables, portal status. This is the useful part of `src/app/admin/clients/page.tsx`.
5. **Billing** — monthly marketing plan and one-time credit repair fee, using `BillingPanel` from the client record. Stripe customer and subscription ids stay here.
6. **Referrals** — this client’s code, referred people, and commissions. The cross-client “ready to pay” queue moves to Today, not a tab.
7. **Tasks** — `getTasksByClient` / the task editor from `src/app/admin/tasks/page.tsx`, scoped to this person.
8. **Messages** — the thread from `src/app/admin/messages/page.tsx`, scoped to this person.

Credit manager file: sections 3, the repair-fee part of billing, tasks, and messages. No Client package section. No marketing subscription. People list query `scope=credit` only returns people who have a credit or funding application.

## Today

Replace `src/app/admin/page.tsx`. Four lists, each row opens the person:

- Consultations in the next 7 days (`listUpcomingBookings`)
- Credit and funding applications in `submitted`, `documents_pending`, `under_review`, `additional_information_requested`
- Clients who owe money: `past_due`, `unpaid`, or an unpaid repair invoice
- Referral commissions that are available to pay

Credit managers see only the applications list.

## Sidebar and old URLs

Owner nav in `src/components/admin/AdminSidebar.tsx`:

- Today → `/admin`
- People → `/admin/people`
- Partners → `/admin/partners`
- Settings → `/admin/settings`

Reference links (Research, Packages, Roadmap, Training) move into Settings as a short list so the daily sidebar stays at four items.

Credit manager nav:

- Today → `/admin`
- People → `/admin/people`
- Settings → `/admin/settings`

`CREDIT_MANAGER_ADMIN_PATHS` in `src/middleware.ts` becomes `/admin`, `/admin/people`, `/admin/dispute-letters`, and `/admin/settings`. `/admin` for a credit manager must not bounce to `/admin/credit-funding?error=unauthorized`.

Permanent redirects in `next.config.js`:

- `/admin/crm` and `/admin/contacts/:entity/:id` → `/admin/people` (detail redirect can be a small route that resolves the old id)
- `/admin/consultations` → `/admin/settings` (hours live there; bookings are on Today)
- `/admin/credit-funding` → `/admin/people`
- `/admin/clients` → `/admin/people`
- `/admin/billing` → `/admin`
- `/admin/referrals` → `/admin/people`
- `/admin/tasks` → `/admin/people`
- `/admin/messages` → `/admin/people`

Keep the API routes. The person file calls the same client, billing, task, message, meeting, consultation, and credit-funding handlers. Delete only the list pages after the person sections cover them.

## Build order

1. **Resolver and People list.** One row per email. Credit-manager filter. Unit tests for “same email, lead plus client plus booking, one person” and “credit manager does not receive a marketing-only person.”
2. **Person file shell** with header, consultation, and credit summary. Old credit page still works until the section includes the real actions.
3. **Client, billing, tasks, messages, referrals** moved onto the file by reusing the current panels.
4. **Today** replaces the overview stats.
5. **Sidebar, Settings hours editor, redirects, credit-manager middleware.** Old list pages redirect. Run typecheck and the CRM, consultation, and billing unit tests. Click through Today → a person → each section on desktop and mobile.

## Out of scope

- A new `people` table or a SQL merge of historical duplicates beyond writing the existing foreign keys.
- Rewriting dispute letters, Stripe checkout, or the public booking page.
- Changing the client portal (`/dashboard`) or the partner portal (`/partner`).
- Removing research, packages, roadmap, or training.
