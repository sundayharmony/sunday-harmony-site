import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const path = req.nextUrl.pathname

  // ── Logged-in clients: redirect away from public pages ──
  // Clients should only interact with their dashboard.
  if (token?.role === 'client') {
    if (path === '/' || path === '/login' || path === '/forgot-password' || path === '/reset-password') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  // ── Logged-in admins: skip login page ──
  if (token?.role === 'admin' && path === '/login') {
    return NextResponse.redirect(new URL('/admin', req.url))
  }

  // ── Protected admin routes: require admin role ──
  if (path.startsWith('/admin')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login?error=unauthorized', req.url))
    }
    if (token.role !== 'admin') {
      return NextResponse.redirect(new URL('/login?error=unauthorized', req.url))
    }
  }

  // ── Protected dashboard routes: require client or admin role ──
  if (path.startsWith('/dashboard')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login?error=unauthorized', req.url))
    }
    if (token.role !== 'client' && token.role !== 'admin') {
      return NextResponse.redirect(new URL('/login?error=unauthorized', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/login', '/forgot-password', '/reset-password', '/admin/:path*', '/dashboard/:path*'],
}
