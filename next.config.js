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
    "worker-src 'self' blob:",
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
  async redirects() {
    return [
      {
        source: '/service',
        destination: '/services',
        permanent: true,
      },
      {
        source: '/credit-funding-application',
        destination: '/credit',
        permanent: true,
      },
      {
        source: '/credit-funding',
        destination: '/credit',
        permanent: true,
      },
      {
        source: '/credit-funding/privacy',
        destination: '/credit/privacy',
        permanent: true,
      },
      {
        source: '/case-studies',
        destination: '/',
        permanent: true,
      },
      {
        source: '/case-studies/:path*',
        destination: '/',
        permanent: true,
      },
      {
        source: '/admin/case-studies',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/admin/revenue',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/admin/revenue/:path*',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/admin/ads',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/admin/ads/:path*',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/admin/competitors',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/admin/competitors/:path*',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/admin/outreach',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/admin/outreach/:path*',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/admin/discovery',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/admin/discovery/:path*',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/admin/files',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/admin/files/:path*',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/admin/team-messages',
        destination: '/admin/credit-funding',
        permanent: true,
      },
      {
        source: '/admin/team-messages/:path*',
        destination: '/admin/credit-funding',
        permanent: true,
      },
      {
        source: '/admin/leads',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/admin/leads/:path*',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/api/case-studies',
        destination: '/',
        permanent: true,
      },
      {
        source: '/api/case-studies/:path*',
        destination: '/',
        permanent: true,
      },
      {
        source: '/api/admin/case-studies',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/api/admin/case-studies/:path*',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/admin/approvals',
        destination: '/admin/clients',
        permanent: true,
      },
      {
        source: '/admin/approvals/:path*',
        destination: '/admin/clients',
        permanent: true,
      },
      {
        source: '/dashboard/approvals',
        destination: '/dashboard',
        permanent: true,
      },
      {
        source: '/dashboard/approvals/:path*',
        destination: '/dashboard',
        permanent: true,
      },
      {
        source: '/api/admin/approvals',
        destination: '/admin/clients',
        permanent: true,
      },
      {
        source: '/api/admin/approvals/:path*',
        destination: '/admin/clients',
        permanent: true,
      },
      {
        source: '/api/dashboard/approvals',
        destination: '/dashboard',
        permanent: true,
      },
      {
        source: '/api/dashboard/approvals/:path*',
        destination: '/dashboard',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
