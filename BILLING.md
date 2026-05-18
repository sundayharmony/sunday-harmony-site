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
4. Run Supabase migrations `003` (billing columns) and `005` (webhook idempotency).

No routine work in the Stripe Dashboard is required after setup.

## How billing works in the app

| Role | Where | Actions |
|------|--------|---------|
| **Client** | `/dashboard/billing` | Subscribe with embedded card form, change plan, cancel, view invoices |
| **Admin** | `/admin/clients` (detail) or `/admin/billing` | Link Stripe customer, copy client billing link, change/cancel subscription. **Cannot enter client card numbers.** |

Stripe.js **Payment Element** runs on your site (no redirect to stripe.com). Card data never touches your server.

## API routes

- `POST /api/billing/setup-intent` — `{ clientId? }` (admin only for clientId)
- `POST /api/billing/subscribe` — `{ tier, paymentMethodId, clientId? }`
- `GET/POST/DELETE /api/billing/payment-methods`
- `POST /api/billing/change-plan` — `{ tier, clientId? }`
- `POST /api/billing/cancel` — `{ action, clientId? }`
- `GET /api/dashboard/billing/invoices` — client invoices
- `GET /api/admin/stripe/invoices?clientId=` — admin invoice list

Hosted Checkout and Customer Portal routes return **410** (retired).

## Data model (`clients` table)

- `package_tier`, `monthly_price` — plan on file; updated from Stripe on subscribe/webhook/sync
- `billing_status` — `not_started` | `trial` | `paid` | `past_due` | `unpaid` (webhook-driven)
- `stripe_customer_id`, `stripe_subscription_id`
- `is_potential` — free until admin activates billing

## MRR reporting

- **Contracted MRR**: sum of `monthly_price` for active, non-potential clients
- **Stripe MRR (est.)**: same sum for clients with active subscription and `paid`/`trial` status

Shown on **Admin → Clients** header and **Admin → Billing**.

## Deleting a client

`DELETE /api/admin/clients` cancels the Stripe subscription (if any) before removing the database row.
