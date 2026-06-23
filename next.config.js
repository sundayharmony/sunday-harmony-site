const path = require('path')

const SUPABASE_HOST = 'https://*.supabase.co'

/** @param {{ allowUnsafeEval?: boolean }} opts */
function buildContentSecurityPolicy({ allowUnsafeEval = false } = {}) {
  const scriptSrc = ["'self'", "'unsafe-inline'", 'https://va.vercel-scripts.com', 'https://js.stripe.com']
  if (allowUnsafeEval) scriptSrc.push("'unsafe-eval'")

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' ${SUPABASE_HOST} https://va.vercel-scripts.com https://vitals.vercel-insights.com https://api.stripe.com https://*.stripe.com`,
    `frame-src ${SUPABASE_HOST} https://js.stripe.com https://hooks.stripe.com https://*.stripe.com`,
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ')
}

const strictCsp = buildContentSecurityPolicy({ allowUnsafeEval: false })
const reportOnlyCsp = `${strictCsp}; report-uri /api/csp-report`

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: strictCsp },
          { key: 'Content-Security-Policy-Report-Only', value: reportOnlyCsp },
        ],
      },
    ]
  },
  poweredByHeader: false,
}

module.exports = nextConfig
