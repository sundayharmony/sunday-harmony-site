import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * Page-route auth only. `/api/*` is NOT matched — each API route must enforce its own auth
 * (requireAdminSession, requireClientSession, etc.). Do not rely on middleware for API security.
 */

/** Public routes where a logged-in client is sent to the dashboard instead. */
const CLIENT_HOME_PATHS = new Set(['/', '/login', '/forgot-password', '/reset-password'])

/** Credit managers may only access these admin page prefixes. */
const CREDIT_MANAGER_ADMIN_PATHS = [
  '/admin/credit-funding',
  '/admin/team-messages',
  '/admin/settings',
]

function redirectUnauthorized(req: NextRequest) {
  return NextResponse.redirect(new URL('/login?error=unauthorized', req.url))
}

function creditManagerAllowed(path: string): boolean {
  return CREDIT_MANAGER_ADMIN_PATHS.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  )
}

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const path = req.nextUrl.pathname
  const role = token?.role

  if (role === 'client' && CLIENT_HOME_PATHS.has(path)) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  if (role === 'admin' && path === '/login') {
    return NextResponse.redirect(new URL('/admin', req.url))
  }

  if (role === 'credit_manager' && path === '/login') {
    return NextResponse.redirect(new URL('/admin/credit-funding', req.url))
  }

  if (path.startsWith('/admin')) {
    if (!token) return redirectUnauthorized(req)

    if (role === 'credit_manager') {
      if (!creditManagerAllowed(path)) {
        const url = new URL('/admin/credit-funding', req.url)
        url.searchParams.set('error', 'unauthorized')
        return NextResponse.redirect(url)
      }
      return NextResponse.next()
    }

    if (role !== 'admin') return redirectUnauthorized(req)
  }

  if (path.startsWith('/dashboard')) {
    if (!token || (role !== 'client' && role !== 'admin' && role !== 'credit_manager')) {
      return redirectUnauthorized(req)
    }
    if (role === 'admin') {
      return NextResponse.redirect(new URL('/admin', req.url))
    }
    if (role === 'credit_manager') {
      return NextResponse.redirect(new URL('/admin/credit-funding', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/login', '/forgot-password', '/reset-password', '/admin/:path*', '/dashboard/:path*'],
}
