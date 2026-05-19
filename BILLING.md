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
- `GET /api/dashboard/billing/invoices` — client invoices
- `GET /api/admin/stripe/invoices?clientId=` — admin invoice list

Hosted Checkout and Customer Portal routes return **410** (retired).

## Data model (`clients` table)

- `package_tier`, `monthly_price` — plan on file; updated from Stripe on subscribe/webhook/sync
- `billing_status` — `not_started` | `trial` | `paid` | `past_due` | `unpaid` (webhook-driven)
- `stripe_customer_id`, `stripe_subscription_id`
- `is_potential` — prospect flag; dashboard access is allowed but billing actions are locked until admin activates

## MRR reporting

- **Contracted MRR**: sum of `monthly_price` for active, non-potential clients
- **Stripe MRR (est.)**: same sum for clients with active subscription and `paid`/`trial` status

Shown on **Admin → Clients** header and **Admin → Billing**.

## Data cleanup checklist (one-time)

For old records created before this lifecycle:

- If `stripe_subscription_id` is empty and `billing_status` is `paid`/`trial`, set `billing_status` to `not_started` (unless `package_tier = 'free'`)
- Ensure `monthly_price` matches tier list price for non-free tiers
- Keep `is_potential` as-is until you explicitly activate billing

## Deleting a client

`DELETE /api/admin/clients` cancels the Stripe subscription (if any) before removing the database row.
