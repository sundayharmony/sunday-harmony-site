import { sanitizeLoginCallbackUrl } from '@/lib/safe-notification-link'

export type SessionUserForLogin = {
  role?: string
  mfaVerified?: boolean
  mfaEnrollmentRequired?: boolean
}

/** Where to send someone after a successful password or passkey sign-in. */
export function destinationAfterLogin(
  user: SessionUserForLogin | undefined,
  fallback = '/'
): string {
  const role = user?.role
  const mfaVerified = user?.mfaVerified
  const mfaEnrollmentRequired = user?.mfaEnrollmentRequired

  if ((role === 'admin' || role === 'credit_manager') && !mfaVerified) {
    return mfaEnrollmentRequired ? '/login/mfa/setup' : '/login/mfa'
  }
  if (role === 'admin') return '/admin'
  if (role === 'credit_manager') return '/admin/credit-funding'
  if (role === 'client') return '/dashboard'
  return sanitizeLoginCallbackUrl(fallback)
}

/**
 * Logged-out visitors just need to sign in.
 * `unauthorized` is only for an existing session that cannot open that page.
 */
export function loginRedirectPath(params: {
  pathname: string
  search?: string
  reason?: 'signin' | 'unauthorized'
}): string {
  const next = new URLSearchParams()
  const dest = `${params.pathname || ''}${params.search || ''}`
  if (dest && dest !== '/login' && !dest.startsWith('/login/')) {
    next.set('callbackUrl', dest)
  }
  if (params.reason === 'unauthorized') next.set('error', 'unauthorized')
  const query = next.toString()
  return query ? `/login?${query}` : '/login'
}

export function loginBannerMessage(
  queryError: string | null | undefined,
  formError: string
): string {
  if (formError) return formError
  if (queryError === 'unauthorized') {
    return 'You do not have permission to access that page. Sign in with an account that does.'
  }
  if (queryError === 'CredentialsSignin' || queryError === 'Callback') {
    return 'Invalid email or password'
  }
  if (queryError) return 'Sign in to continue.'
  return ''
}
