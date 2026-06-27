import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'

/**
 * Page-route auth only. `/api/*` is NOT matched — each API route must enforce its own auth
 * (requireAdminSession, requireClientSession, etc.). Do not rely on middleware for API security.
 */

/** Public routes where a logged-in client is sent to the dashboard instead. */
const CLIENT_HOME_PATHS = new Set(['/', '/login', '/forgot-password', '/reset-password'])

function redirectUnauthorized(req: NextRequest) {
  return NextResponse.redirect(new URL('/login?error=unauthorized', req.url))
}

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const path = req.nextUrl.pathname

  if (token?.role === 'client' && CLIENT_HOME_PATHS.has(path)) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  if (token?.role === 'admin' && path === '/login') {
    return NextResponse.redirect(new URL('/admin', req.url))
  }

  if (path.startsWith('/admin')) {
    if (!token || token.role !== 'admin') return redirectUnauthorized(req)
  }

  if (path.startsWith('/dashboard')) {
    if (!token || (token.role !== 'client' && token.role !== 'admin')) {
      return redirectUnauthorized(req)
    }
    if (token.role === 'admin') {
      return NextResponse.redirect(new URL('/admin', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/login', '/forgot-password', '/reset-password', '/admin/:path*', '/dashboard/:path*'],
}
