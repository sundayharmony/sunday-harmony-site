# Billing (Stripe + embedded payments)

## One-time Stripe setup

1. Create four monthly recurring **Prices** in Stripe and set env vars:
   - `STRIPE_PRICE_SOCIAL_ESSENTIALS`
   - `STRIPE_PRICE_SPARK`
   - `STRIPE_PRICE_GROWTH`
   - `STRIPE_PRICE_SCALE`
2. Set `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`.
3. Add webhook endpoint: `https://<your-domain>/api/stripe/webhook` with events:
   - `checkout.session.completed` (legacy)
   - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`
   - `setup_intent.succeeded`, `customer.subscription.trial_will_end`

`invoice.paid` emails `NOTIFY_EMAIL` (default `sales@sundayharmony.com`) a payment-received confirmation for credit-repair fees and marketing subscriptions, in addition to the client SMTP receipt.
4. Run Supabase migrations `003` (billing columns) and `005` (webhook idempotency).

No routine work in the Stripe Dashboard is required after setup.

## Credit repair (one-time fee)

Credit repair clients are **not** marketing subscribers. Intake sets `clients.billing_model = credit_repair_one_time`.

Staff charge from **Admin → Credit & Funding** (Repair fee on Overview) or **Admin → Clients**. Both surfaces include a **Credit Repair** package option next to the marketing plans. Switching a repair client to Social Essentials / Spark / Growth / Scale sets `billing_model` back to `marketing_subscription` so you can activate billing and start a subscription. Switching the other way requires canceling any active marketing subscription first.

1. Enter the fee. If a card is on file, **Charge card on file** bills it immediately. If there is no card, that same action emails a Stripe invoice instead of erroring.
2. **Email invoice** always sends a pay link (even when a card is on file).
3. Every charge or emailed invoice creates a Stripe Invoice. Admin **Payment history** and the client **Billing** page list each one (open, paid, or failed).
4. The client always gets a Sunday Harmony invoice/receipt email via SMTP. Stripe `sendInvoice` is also called so the hosted pay link exists. Paying the emailed link later still emails a receipt (`invoice.paid` webhook). If SMTP is not configured, staff see an error and can copy/resend the invoice link.
5. Use **Resend invoice email** to send the latest invoice again.
6. `invoice.paid` marks the client paid (`repair_fee_paid_at`, `billing_status = paid`) and updates the latest fee amount. The same webhook emails `NOTIFY_EMAIL` a payment-received confirmation (card-on-file charges and hosted invoice payments).
7. Charging looks up **card and Link** methods, including the Stripe customer's default. If the linked Stripe customer has no method, we search other customers with the same email (never stealing another client's customer) and use the one that already has a card. Saving a card on `/dashboard/billing` stores the Stripe customer the payment method actually landed on, so a later charge uses that same card.

Optional env: `CREDIT_REPAIR_DEFAULT_FEE_CENTS` (USD cents) as the amount prefill.

One-time repair fees are excluded from marketing MRR. Run migration `037`.

## How billing works in the app

| Role | Where | Actions |
|------|--------|---------|
| **Client** | `/dashboard/billing` | Add/update card, set default card, view invoices and status |
| **Admin** | `/admin/clients` (detail) or `/admin/billing` | Save plan, activate billing, start/change/cancel subscription, sync Stripe. **Cannot enter client card numbers.** |

Stripe.js **Payment Element** runs on your site (no redirect to stripe.com). Card data never touches your server.

### Canonical lifecycle

1. Create client (optionally as potential): contracted plan is stored in `package_tier` + `monthly_price`
2. Admin activates billing (`is_potential = false`)
3. Client adds card on dashboard
4. Admin starts subscription explicitly
5. Stripe webhooks keep `billing_status`, `stripe_subscription_id`, and next billing date in sync

## API routes

- `POST /api/billing/setup-intent` — `{ clientId? }` (admin only for clientId)
- `POST /api/billing/save-card` — `{ paymentMethodId, clientId? }` (client dashboard flow)
- `POST /api/billing/subscribe` — admin-only legacy/manual route
- `GET/POST/DELETE /api/billing/payment-methods`
- `POST /api/billing/change-plan` — admin-only plan change for active subscriptions
- `POST /api/billing/cancel` — admin-only cancel/resume actions
- `POST /api/admin/clients/plan` — `{ clientId, tier, hasSubscription? }`
- `POST /api/admin/clients/billing/activate` — `{ clientId }`
- `POST /api/admin/clients/billing/start` — `{ clientId, tier? }`
- `GET /api/admin/clients/billing-status?clientId=` — stripe/db drift snapshot
- `GET/POST /api/admin/clients/repair-billing` — one-time credit repair fee (admin or credit manager)
- `GET/POST /api/admin/credit-funding/[id]/repair-billing` — same, scoped to an application
- `GET /api/dashboard/billing/invoices` — client invoices
- `GET /api/admin/stripe/invoices?clientId=` — admin invoice list

Hosted Checkout and Customer Portal routes return **410** (retired).

## Data model (`clients` table)

- `package_tier`, `monthly_price` — marketing plan on file; unused for credit repair fees
- `billing_model` — `marketing_subscription` | `credit_repair_one_time`
- `billing_status` — `not_started` | `trial` | `paid` | `past_due` | `unpaid` (webhook-driven)
- `stripe_customer_id`, `stripe_subscription_id`
- `repair_fee_cents`, `repair_fee_paid_at`, `stripe_repair_invoice_id` — one-time repair fee
- `is_potential` — prospect flag; marketing billing is locked until admin activates. Credit repair clients can add a card before the fee is charged.

## MRR reporting

- **Contracted MRR**: sum of `monthly_price` for active, non-potential marketing clients (excludes credit repair)
- **Stripe MRR (est.)**: same sum for clients with active subscription and `paid`/`trial` status

Shown on **Admin → Clients** header and **Admin → Billing**.

## Data cleanup checklist (one-time)

For old records created before this lifecycle:

- If `stripe_subscription_id` is empty and `billing_status` is `paid`/`trial`, set `billing_status` to `not_started` (unless `package_tier = 'free'`)
- Ensure `monthly_price` matches tier list price for non-free tiers
- Keep `is_potential` as-is until you explicitly activate billing

## Deleting a client

`DELETE /api/admin/clients` cancels the Stripe subscription (if any) before removing the database row.
