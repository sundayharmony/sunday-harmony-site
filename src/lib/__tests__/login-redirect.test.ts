import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  destinationAfterLogin,
  loginBannerMessage,
  loginRedirectPath,
} from '../login-redirect'

describe('loginRedirectPath', () => {
  it('sends logged-out visitors to login with a return path and no permission error', () => {
    assert.equal(
      loginRedirectPath({ pathname: '/admin/credit-funding' }),
      '/login?callbackUrl=%2Fadmin%2Fcredit-funding'
    )
    assert.equal(loginRedirectPath({ pathname: '/dashboard', search: '?tab=1' }), '/login?callbackUrl=%2Fdashboard%3Ftab%3D1')
    assert.equal(loginRedirectPath({ pathname: '/login' }), '/login')
  })

  it('keeps unauthorized only when an existing session cannot open the page', () => {
    assert.equal(
      loginRedirectPath({ pathname: '/admin', reason: 'unauthorized' }),
      '/login?callbackUrl=%2Fadmin&error=unauthorized'
    )
  })
})

describe('loginBannerMessage', () => {
  it('prefers the form error so a sign-in attempt is not stuck on the URL banner', () => {
    assert.equal(
      loginBannerMessage('unauthorized', 'Invalid email or password'),
      'Invalid email or password'
    )
    assert.equal(loginBannerMessage('unauthorized', ''), 'You do not have permission to access that page. Sign in with an account that does.')
    assert.equal(loginBannerMessage('CredentialsSignin', ''), 'Invalid email or password')
    assert.equal(loginBannerMessage(null, ''), '')
  })
})

describe('destinationAfterLogin', () => {
  it('sends staff to MFA before admin when the password step is not finished', () => {
    assert.equal(
      destinationAfterLogin({ role: 'admin', mfaVerified: false, mfaEnrollmentRequired: true }),
      '/login/mfa/setup'
    )
    assert.equal(destinationAfterLogin({ role: 'admin', mfaVerified: true }), '/admin')
    assert.equal(destinationAfterLogin({ role: 'credit_manager', mfaVerified: true }), '/admin/credit-funding')
    assert.equal(destinationAfterLogin({ role: 'client' }), '/dashboard')
  })
})

describe('login middleware wiring', () => {
  it('does not stamp error=unauthorized for a missing session', () => {
    const middleware = readFileSync('src/middleware.ts', 'utf8')
    assert.match(middleware, /loginRedirectPath/)
    assert.match(middleware, /if \(!token\) return redirectToLogin\(req\)/)
    assert.doesNotMatch(middleware, /if \(!token\) return redirectToLogin\(req, 'unauthorized'\)/)
  })
})
