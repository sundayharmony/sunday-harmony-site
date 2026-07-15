---
name: "Area 10 Fix Plan - Stripe Webhook and Billing Authorization Review"
overview: "The Stripe integration already verifies webhook signatures, dedupes event ids, scopes client billing access, and keeps raw card data out of the app. Remaining risks are targeted: one shared billing auth helper lets admin sessions bypass the MFA requirement, webhook DB write failures can be swallowed after an event is claimed, client-callable billing routes lack durable rate limits, and Stripe customer linkage can cross tenants when emails collide."
todos:
  - id: billing-admin-mfa
    content: "Require MFA-verified admin sessions in authorizeBillingClient before any admin billing mutation or payment-method access"
    status: pending
  - id: webhook-write-failures
    content: "Make webhook client updates fail loudly so Stripe retries instead of permanently claiming failed events"
    status: pending
  - id: billing-rate-limits
    content: "Add durable per-client/session limits to setup-intent, save-card, and payment-methods routes"
    status: pending
  - id: stripe-customer-uniqueness
    content: "Prevent cross-tenant Stripe customer/subscription linkage with code checks and non-empty unique indexes"
    status: pending
  - id: stale-event-and-error-hardening
    content: "Refetch or guard subscription events, sanitize Stripe error responses, and trim dead checkout trust paths"
    status: pending
  - id: tests
    content: "Add focused billing auth, webhook retry, customer-linkage, and rate-limit tests"
    status: pending
isProject: false
---

# Area 10 - Deep Dive + Fix Plan

**Status:** plan-ready (awaiting implement)
**Priority:** P2
**Scope:** Stripe webhook handling, billing route authorization, customer/subscription mapping, payment-method operations, and subscription state synchronization.

---

## Summary

The billing surface has several strong pieces already:

- `POST /api/stripe/webhook` verifies the raw body with `STRIPE_WEBHOOK_SECRET`.
- Webhook event ids are claimed in `stripe_webhook_events`; thrown handler errors release the claim and return 500 so Stripe retries.
- Client billing access uses the session-derived `clientId`; clients cannot pick another tenant by body/query.
- Money-changing subscription routes are admin-only, and card entry uses SetupIntents/Stripe Elements rather than server-handled card data.
- Payment-method operations verify the method belongs to the resolved Stripe customer before defaulting or detaching.
- Price/tier inputs come from server-side catalog/env mappings, not user-submitted amounts.

The remaining issues are not broad public exposure, but they can affect money state or tenant billing privacy.

---

## Findings

### 1. Admin billing helper bypasses MFA - Medium/High

`authorizeBillingClient` accepts `session.user.role === 'admin'` and a supplied `clientId`, but does not require `session.user.mfaVerified`. The normal admin helper (`requireAdminSession`) does enforce MFA, and API routes are not protected by middleware.

Affected routes include:

- `src/app/api/billing/subscribe/route.ts`
- `src/app/api/billing/change-plan/route.ts`
- `src/app/api/billing/cancel/route.ts`
- `src/app/api/billing/payment-methods/route.ts`
- `src/app/api/billing/setup-intent/route.ts`

Impact: a stolen or pre-MFA admin session could mutate subscriptions, cancel plans, create setup intents, or view/delete payment methods for any `clientId`.

**Fix direction:** centralize the admin branch around the MFA-aware admin check, or add the same `mfaVerified` gate directly in `authorizeBillingClient`.

### 2. Webhook DB-update failures can be claimed permanently - Medium

`applySubscriptionToClient` calls `updateClient` and ignores the returned value. `updateClient` logs Supabase errors and returns `null`; it does not throw. Several direct webhook `updateClient` calls have the same issue.

Because `stripe_webhook_events` is claimed before processing, a non-throwing DB failure returns 200 and leaves the event marked processed. Stripe will not retry, so the local billing row can drift from Stripe until manual sync.

**Fix direction:** add checked update helpers for webhook paths. If the client update fails, throw so the existing catch releases the event claim and Stripe retries.

### 3. Client-callable billing routes lack durable limits - Medium

`/api/billing/setup-intent`, `/api/billing/save-card`, and `/api/billing/payment-methods` do not use `rateLimitDurable`. Auth is required, but an authenticated client can still generate repeated SetupIntents or hammer Stripe payment-method operations.

**Fix direction:** use existing durable rate limiting with keys scoped by actor/client and operation:

- setup intent: low/medium per client per hour
- save card/default/detach: stricter per client per 15 minutes
- list payment methods: modest per client per minute

### 4. Email-based Stripe customer linking can cross tenants - Medium/Low

`ensureStripeCustomerForClient` searches Stripe by email and adopts the first customer match. If two client rows share an email, the second client can inherit the first client's Stripe customer. There are also no non-empty unique indexes on `clients.stripe_customer_id` or `clients.stripe_subscription_id`.

Impact: possible cross-tenant invoice/payment-method metadata exposure and webhook ambiguity. `getClientByStripeCustomerId(...).single()` also returns undefined on duplicates, which can silently skip webhook processing.

**Fix direction:** before adopting a Stripe customer found by email, verify it is not already linked to a different client row. Add partial unique indexes for non-empty customer/subscription ids.

### 5. Subscription event ordering is not guarded - Low

The idempotency table handles duplicate event ids, but distinct subscription events are applied in arrival order. Stripe does not guarantee event ordering. `invoice.paid` and checkout handlers re-fetch subscriptions from Stripe, but `customer.subscription.updated` uses the embedded event object.

**Fix direction:** re-fetch the subscription for create/update events before applying, or skip stale updates when the local row no longer references that subscription.

### 6. Stripe errors can leak internal details - Low

`mapStripeError` returns `err.message` for generic `Error` and unknown Stripe error types at status 500. That can expose configuration or provider internals to callers.

**Fix direction:** log server-side details, return generic billing-service errors for 500-class responses, and preserve user-actionable card/rate-limit messages.

### 7. Dead checkout fallback trusts `client_reference_id` - Low

Hosted checkout routes are retired, but the webhook still falls back to `checkoutSession.client_reference_id` as a client id. It is currently dead-path shaped, but it is untrusted input if Checkout is ever re-enabled.

**Fix direction:** remove the fallback or only trust server-set metadata after validating customer linkage.

---

## Already solid

- Webhook signature verification uses Stripe's signing secret and raw request body.
- Webhook idempotency exists and is service-role only after the RLS hardening work.
- Clients are scoped to their own session `clientId`.
- Admin-only subscription mutation is enforced at the role level.
- Card data stays in Stripe; the app handles SetupIntent IDs and PaymentMethod IDs only.
- Payment-method ownership is checked against the customer's id before defaulting or detaching.
- Billing activity logs exist for subscription and payment-method mutations.
- Production Vercel has Stripe secrets configured as encrypted environment variables; no Stripe keys were found in committed source during this review.

---

## Implementation plan

1. **MFA billing auth:** update `authorizeBillingClient` so admin access requires an MFA-verified admin session. Add tests for admin without MFA, admin with MFA, client-owned access, and client cross-tenant rejection.
2. **Webhook retry correctness:** introduce a checked client update helper for webhook sync. Use it from `applySubscriptionToClient` and direct webhook update branches so DB failures throw and release the idempotency claim.
3. **Durable route limits:** add `rateLimitDurable` to setup-intent, save-card, and payment-method operations using actor/client-scoped keys. Add focused tests or source-structure assertions matching the existing rate-limit tests.
4. **Customer/subscription uniqueness:** add a migration with partial unique indexes where `stripe_customer_id` / `stripe_subscription_id` are not null/empty. Add lookup helpers that detect duplicates explicitly.
5. **Safe customer adoption:** update `ensureStripeCustomerForClient` to avoid linking a Stripe customer already attached to another client row. Prefer creating a new customer over cross-linking.
6. **Event freshness:** re-fetch subscriptions for create/update webhook events before applying local state, matching the safer invoice-paid path.
7. **Error/output cleanup:** sanitize 500-level Stripe error responses; remove dead `client_reference_id` fallback; optionally add admin invoice audit logging.

---

## Acceptance criteria

- [ ] Admin billing routes reject non-MFA admin sessions.
- [ ] Webhook client update failures release the event claim and return 500.
- [ ] Billing setup/payment-method routes have durable per-client/session limits.
- [ ] A Stripe customer/subscription id cannot be assigned to multiple clients.
- [ ] Email search never adopts a customer already linked to a different client row.
- [ ] Subscription create/update events are not applied from stale embedded payloads.
- [ ] Stripe 500 responses do not expose raw internal messages.
- [ ] Focused tests, full unit tests, typecheck, and build pass.

---

## Deferred / overlap

- **Area 03:** Stripe key rotation and restricted-key migration remain secret-hygiene/ops work.
- **Area 07:** billing route throttling is the remaining billing-specific slice of rate limiting.
- **Area 12:** Stripe customer deletion policy and webhook-event retention are lifecycle/ops cleanup items.
