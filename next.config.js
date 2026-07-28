const path = require('path')

const SUPABASE_HOST = 'https://*.supabase.co'

function buildContentSecurityPolicy() {
  const scriptSources = [
    "'self'",
    "'unsafe-inline'",
    ...(process.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : []),
    'https://va.vercel-scripts.com',
    'https://js.stripe.com',
    'https://vercel.live',
  ]

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `img-src 'self' data: blob: ${SUPABASE_HOST} https://*.stripe.com`,
    `connect-src 'self' ${SUPABASE_HOST} https://va.vercel-scripts.com https://vitals.vercel-insights.com https://api.stripe.com https://*.stripe.com https://vercel.live`,
    `frame-src ${SUPABASE_HOST} https://js.stripe.com https://hooks.stripe.com https://*.stripe.com`,
    "worker-src 'self' blob: https://cdn.jsdelivr.net",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
    'report-uri /api/csp-report',
  ].join('; ')
}

const csp = buildContentSecurityPolicy()

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: [
    'pdfkit',
    'fontkit',
  ],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '0' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ]
  },
  poweredByHeader: false,
}

module.exports = nextConfig
