const path = require('path')

const SUPABASE_HOST = 'https://*.supabase.co'

/**
 * Next.js webpack runtime uses Function("return this")() (see webpack-*.js chunk),
 * which requires 'unsafe-eval' in script-src. Without it, Chrome reports CSP eval blocks.
 */
function buildContentSecurityPolicy() {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://js.stripe.com https://vercel.live",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' ${SUPABASE_HOST} https://va.vercel-scripts.com https://vitals.vercel-insights.com https://api.stripe.com https://*.stripe.com https://vercel.live`,
    `frame-src ${SUPABASE_HOST} https://js.stripe.com https://hooks.stripe.com https://*.stripe.com`,
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ')
}

const csp = buildContentSecurityPolicy()

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
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ]
  },
  poweredByHeader: false,
}

module.exports = nextConfig
