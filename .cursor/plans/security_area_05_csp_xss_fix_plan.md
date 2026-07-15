---
name: "Area 05 Fix Plan — CSP Tightening + XSS Sinks"
overview: "CSP allows unsafe-inline and unsafe-eval scripts, which neuters it against injected scripts. The dispute-letters admin page renders API-provided HTML unsanitized. Plan: drop unsafe-eval in production, sanitize the dispute-letter HTML sink, tighten img-src, and fix the deprecated X-XSS-Protection header. Implement only after approval."
todos:
  - id: drop-unsafe-eval
    content: "Environment-aware CSP: remove unsafe-eval from script-src in production"
    status: pending
  - id: sanitize-letters
    content: "Sanitize dispute-letter HTML before dangerouslySetInnerHTML"
    status: pending
  - id: tighten-img-src
    content: "Restrict img-src from https: wildcard to a named list"
    status: pending
  - id: header-fixes
    content: "Set X-XSS-Protection: 0 (deprecated header) + cap csp-report body"
    status: pending
isProject: false
---

# Area 05 — Deep dive + fix plan

**Status:** plan-ready (awaiting permission to implement)
**Priority:** P1
**Scope:** `next.config.js` security headers/CSP, `dangerouslySetInnerHTML` usage, CSP report endpoint.

---

## What's already good

- CSP exists at all, with `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `upgrade-insecure-requests`, and a working `report-uri /api/csp-report` endpoint.
- HSTS with preload, `nosniff`, referrer policy, permissions policy all set; `poweredByHeader` off.
- Only **one** `dangerouslySetInnerHTML` in the entire app (dispute letters). No `eval`, `new Function`, `insertAdjacentHTML`, or JSON-LD inline scripts in app code. The single `innerHTML = ''` in `CaseStudyPdfSheet` is a clear operation, not a sink.
- The Python letter formatter (`services/dispute-letters-api/app/services/letter_formatter.py`) HTML-escapes all text via `html.escape` and only emits `<p>`/`<strong>` — the producer side is clean.

## Findings

### 1. `script-src` allows `unsafe-inline` + `unsafe-eval` (main issue)

```12:12:next.config.js
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://js.stripe.com https://vercel.live https://cdn.jsdelivr.net",
```

With both flags, CSP provides almost no protection against injected scripts — any XSS that lands executes freely.

- **`unsafe-eval`:** the in-code comment claims the webpack runtime needs it. I checked the actual production build: `webpack-*.js` and `polyfills-*.js` contain `Function("return this")`, but it is webpack's standard `globalThis` shim — guarded by `typeof globalThis === 'object'` (true in every browser this site supports) and wrapped in try/catch with a `window` fallback. The eval branch never executes in modern browsers, so **`unsafe-eval` can be dropped in production**. Dev mode (HMR) genuinely needs it, so the CSP should be environment-aware.
- **`unsafe-inline`:** Next.js App Router injects inline bootstrap/hydration scripts, so removing it requires nonce-based CSP via middleware — which forces every page to render dynamically (marketing pages lose static caching). That trade-off needs its own decision; **keep `unsafe-inline` for now**, revisit after the P1s (noted as deferred, not forgotten).

### 2. Dispute-letter HTML sink is unsanitized (defense-in-depth gap)

```88:88:src/app/admin/dispute-letters/[sessionId]/letters/page.tsx
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: active.html }} />
```

The HTML comes from the Railway API response stored via the letters flow. The producer escapes correctly **today**, but the browser page trusts whatever the API/DB returns. If the Railway service, its dependencies, or the stored rows are ever compromised or a future formatter change slips, this becomes stored XSS on an **admin** page — the worst place for it (session/CSRF-token theft, full CRM access). Because generated letters only ever contain `<p class="...">` and `<strong>`, a strict allowlist sanitizer is cheap and lossless.

### 3. `img-src 'self' data: blob: https:` — any HTTPS origin

Broad image loading enables tracking-pixel-style exfiltration if HTML injection is ever possible and makes CSP reports noisier. App images come from: self, `data:`/`blob:` previews, Supabase signed URLs, and Stripe. Tighten to a named list.

### 4. `X-XSS-Protection: 1; mode=block` is deprecated

Modern guidance (OWASP/MDN) is to set `0` — the legacy XSS auditor it toggles introduced its own vulnerabilities and is removed from modern browsers. Cosmetic but should follow current guidance.

### 5. CSP report endpoint accepts unbounded anonymous JSON

`/api/csp-report` logs whatever it receives with no size cap or rate limit — log-spam vector only, but a one-line guard is cheap.

---

## Fix plan (implement after approval)

### Step 1 — Environment-aware CSP in `next.config.js`

- Include `'unsafe-eval'` in `script-src` **only when `NODE_ENV !== 'production'`**.
- Verify on a Vercel preview deploy + watch `/api/csp-report` logs for regressions before considering it done.

### Step 2 — Sanitize the dispute-letter sink

- Add a small allowlist sanitizer (letters only need `p`, `strong`, `br` and the `class` attribute with `letter-*` values) in `src/lib/dispute-letters/` and run `active.html` through it before `dangerouslySetInnerHTML`.
- No new dependency needed for this narrow shape; DOMPurify remains the fallback option if letters ever need richer HTML.

### Step 3 — Tighten `img-src`

- Replace `https:` with: `'self' data: blob:` + Supabase host + `https://*.stripe.com`.
- Watch CSP reports for anything legitimate that breaks (report-uri already wired).

### Step 4 — Header cleanups

- `X-XSS-Protection: 0`.
- Cap `/api/csp-report` body handling (ignore payloads over ~32 KB) and keep the 204 contract.

### Deferred (recorded, not lost)

- **Nonce-based CSP to remove `unsafe-inline`** — requires dynamic rendering of all pages; revisit after P1 areas are closed.
- `style-src 'unsafe-inline'` stays (needed by styled-jsx/Next inline styles; low risk).

### Risk

Low. The eval shim is guarded/try-caught, so dropping `unsafe-eval` in production is safe for supported browsers; preview-deploy verification plus CSP reporting catches surprises. The sanitizer is additive on a single admin page.

---

## Success criteria

- [ ] Production CSP has no `unsafe-eval`; dev still works (HMR)
- [ ] Dispute-letter HTML passes through an allowlist sanitizer
- [ ] `img-src` restricted to named origins
- [ ] `X-XSS-Protection: 0`; csp-report body capped
- [ ] Preview deploy shows no CSP regressions in report logs
