import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { loginRedirectPath } from '@/lib/login-redirect'
import { isStaffRole } from '@/lib/staff-roles'
import { isStaffSessionExpired, sessionCookieNamesToClear } from '@/lib/staff-session'

/**
 * Page-route auth only. `/api/*` is NOT matched — each API route must enforce its own auth
 * (requireAdminSession, requireClientSession, etc.). Do not rely on middleware for API security.
 */

/** Public routes where a logged-in client is sent to the dashboard instead. */
const CLIENT_HOME_PATHS = new Set(['/', '/login', '/forgot-password', '/reset-password'])

/**
 * Paths staff may use while MFA is still incomplete.
 * Must include password recovery — otherwise a pending MFA cookie traps users on
 * /login/mfa and they cannot enter an emailed reset code on /reset-password.
 */
const MFA_INCOMPLETE_ALLOWED = new Set(['/login', '/forgot-password', '/reset-password'])

/** Credit managers use Today, People, the credit workspace, and Settings. */
const CREDIT_MANAGER_ADMIN_PATHS = [
  '/admin/people',
  '/admin/credit-funding',
  '/admin/dispute-letters',
  '/admin/settings',
]

function redirectToLogin(req: NextRequest, reason: 'signin' | 'unauthorized' = 'signin') {
  return NextResponse.redirect(
    new URL(
      loginRedirectPath({
        pathname: req.nextUrl.pathname,
        search: req.nextUrl.search,
        reason,
      }),
      req.url
    )
  )
}

function creditManagerAllowed(path: string): boolean {
  if (path === '/admin') return true
  return CREDIT_MANAGER_ADMIN_PATHS.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  )
}

function mfaIncompletePathAllowed(path: string): boolean {
  if (MFA_INCOMPLETE_ALLOWED.has(path)) return true
  if (path === '/login/mfa' || path.startsWith('/login/mfa/')) return true
  return false
}

function clearSessionCookies(req: NextRequest, response: NextResponse) {
  const names = sessionCookieNamesToClear(req.cookies.getAll().map((cookie) => cookie.name))
  for (const name of names) {
    response.cookies.set(name, '', {
      path: '/',
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
      secure: name.startsWith('__Secure-') || name.startsWith('__Host-'),
    })
  }
}

function onPublicAuthScreen(path: string): boolean {
  return path === '/login' || path.startsWith('/login/') || path === '/forgot-password' || path === '/reset-password'
}

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const path = req.nextUrl.pathname
  const role = token?.role as string | undefined
  const staff = isStaffRole(role)
  const mfaVerified = Boolean(token?.mfaVerified)
  const mfaEnrollmentRequired = Boolean(token?.mfaEnrollmentRequired)

  // Staff JWTs last 8 hours. The raw cookie can still look signed-in after that,
  // which left people on a Forbidden screen instead of the login page.
  if (
    token &&
    (token.sessionExpired ||
      isStaffSessionExpired({
        role,
        iat: typeof token.iat === 'number' ? token.iat : undefined,
        staffSessionStartedAt:
          typeof token.staffSessionStartedAt === 'number' ? token.staffSessionStartedAt : undefined,
      }))
  ) {
    const response = onPublicAuthScreen(path) ? NextResponse.next() : redirectToLogin(req)
    clearSessionCookies(req, response)
    return response
  }

  // Staff must finish MFA / enrollment before any protected surface.
  // Do not trap them out of login or password-reset — that made emailed codes unusable.
  if (token && staff && !mfaVerified && !mfaIncompletePathAllowed(path)) {
    return NextResponse.redirect(
      new URL(mfaEnrollmentRequired ? '/login/mfa/setup' : '/login/mfa', req.url)
    )
  }

  if (role === 'client' && CLIENT_HOME_PATHS.has(path)) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  if (role === 'partner' && (path === '/login' || path === '/')) {
    return NextResponse.redirect(new URL('/partner', req.url))
  }

  if (role === 'admin' && mfaVerified && path === '/login') {
    return NextResponse.redirect(new URL('/admin', req.url))
  }

  if (role === 'credit_manager' && mfaVerified && path === '/login') {
    return NextResponse.redirect(new URL('/admin', req.url))
  }

  if (path.startsWith('/admin')) {
    if (!token) return redirectToLogin(req)
    if (staff && !mfaVerified) {
      return NextResponse.redirect(
        new URL(mfaEnrollmentRequired ? '/login/mfa/setup' : '/login/mfa', req.url)
      )
    }

    if (role === 'credit_manager') {
      if (!creditManagerAllowed(path)) {
        return NextResponse.redirect(new URL('/admin', req.url))
      }
      return NextResponse.next()
    }

    if (role !== 'admin') return redirectToLogin(req, 'unauthorized')
  }

  if (path === '/partner' || path.startsWith('/partner/')) {
    if (!token) return redirectToLogin(req)
    if (role !== 'partner') return redirectToLogin(req, 'unauthorized')
    return NextResponse.next()
  }

  if (path.startsWith('/dashboard')) {
    if (!token) return redirectToLogin(req)
    if (role !== 'client' && role !== 'admin' && role !== 'credit_manager') {
      return redirectToLogin(req, 'unauthorized')
    }
    if (role === 'admin') {
      if (!mfaVerified) {
        return NextResponse.redirect(
          new URL(mfaEnrollmentRequired ? '/login/mfa/setup' : '/login/mfa', req.url)
        )
      }
      return NextResponse.redirect(new URL('/admin', req.url))
    }
    if (role === 'credit_manager') {
      if (!mfaVerified) {
        return NextResponse.redirect(
          new URL(mfaEnrollmentRequired ? '/login/mfa/setup' : '/login/mfa', req.url)
        )
      }
      return NextResponse.redirect(new URL('/admin', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/login/:path*',
    '/forgot-password',
    '/reset-password',
    '/admin',
    '/admin/:path*',
    '/dashboard/:path*',
    '/partner',
    '/partner/:path*',
  ],
}
