import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, it } from 'node:test'
import {
  readTurnstileToken,
  resetTurnstileWarningForTests,
  turnstileFailureResponse,
  verifyTurnstile,
  TURNSTILE_SITEVERIFY_URL,
} from '../turnstile'
import {
  CONSULTATION_EMAIL_LIMIT,
  CREDIT_EMAIL_LIMIT,
  CREDIT_START_CONFLICT,
  consultationEmailRateLimit,
  creditEmailRateLimit,
  emailLimitKey,
} from '../public-form-guards'
import { consultationBookingNote, existingLeadUpdateForBooking } from '../consultation-lead'

const KEYS = {
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site-key',
  TURNSTILE_SECRET_KEY: 'secret-key',
} as unknown as NodeJS.ProcessEnv

function fakeFetch(reply: unknown, status = 200) {
  const calls: Array<{ url: string; body: URLSearchParams }> = []
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: init.body as URLSearchParams })
    return new Response(JSON.stringify(reply), { status })
  }) as unknown as typeof fetch
  return { impl, calls }
}

const read = (path: string) => readFileSync(path, 'utf8')

describe('Turnstile verification', () => {
  let warn: typeof console.warn
  let error: typeof console.error
  let warnings: string[]
  beforeEach(() => {
    resetTurnstileWarningForTests()
    warnings = []
    warn = console.warn
    error = console.error
    console.warn = (msg: string) => warnings.push(msg)
    console.error = () => {}
  })
  afterEach(() => {
    console.warn = warn
    console.error = error
  })

  it('skips with one warning when the keys are unset, so the site boots without secrets', async () => {
    const { impl, calls } = fakeFetch({ success: false })
    const first = await verifyTurnstile({ token: '', action: 'contact', env: {} as NodeJS.ProcessEnv, fetchImpl: impl })
    const second = await verifyTurnstile({ token: '', action: 'contact', env: {} as NodeJS.ProcessEnv, fetchImpl: impl })
    assert.deepEqual(first, { ok: true, skipped: true })
    assert.deepEqual(second, { ok: true, skipped: true })
    assert.equal(calls.length, 0)
    assert.equal(warnings.length, 1)
    assert.match(warnings[0], /TURNSTILE_SECRET_KEY/)
  })

  it('skips when only one key is set instead of locking every visitor out', async () => {
    const result = await verifyTurnstile({
      token: '',
      action: 'contact',
      env: { TURNSTILE_SECRET_KEY: 'secret' } as unknown as NodeJS.ProcessEnv,
    })
    assert.deepEqual(result, { ok: true, skipped: true })
  })

  it('rejects a missing token without calling Cloudflare when configured', async () => {
    const { impl, calls } = fakeFetch({ success: true })
    const result = await verifyTurnstile({ token: '  ', action: 'contact', env: KEYS, fetchImpl: impl })
    assert.deepEqual(result, { ok: false, reason: 'missing-token' })
    assert.equal(calls.length, 0)
  })

  it('sends the secret, token and client IP to siteverify and accepts a matching action', async () => {
    const { impl, calls } = fakeFetch({ success: true, action: 'consultation' })
    const result = await verifyTurnstile({
      token: 'tok',
      action: 'consultation',
      remoteIp: '203.0.113.7',
      env: KEYS,
      fetchImpl: impl,
    })
    assert.deepEqual(result, { ok: true, skipped: false })
    assert.equal(calls[0].url, TURNSTILE_SITEVERIFY_URL)
    assert.equal(calls[0].body.get('secret'), 'secret-key')
    assert.equal(calls[0].body.get('response'), 'tok')
    assert.equal(calls[0].body.get('remoteip'), '203.0.113.7')
  })

  it('rejects an invalid token, a token minted for another form, and a siteverify outage', async () => {
    const bad = await verifyTurnstile({
      token: 'tok',
      action: 'contact',
      env: KEYS,
      fetchImpl: fakeFetch({ success: false, 'error-codes': ['timeout-or-duplicate'] }).impl,
    })
    assert.deepEqual(bad, { ok: false, reason: 'invalid-token', codes: ['timeout-or-duplicate'] })

    const otherForm = await verifyTurnstile({
      token: 'tok',
      action: 'credit_start',
      env: KEYS,
      fetchImpl: fakeFetch({ success: true, action: 'contact' }).impl,
    })
    assert.deepEqual(otherForm, { ok: false, reason: 'action-mismatch' })

    const down = await verifyTurnstile({
      token: 'tok',
      action: 'contact',
      env: KEYS,
      fetchImpl: (async () => {
        throw new Error('network')
      }) as unknown as typeof fetch,
    })
    assert.deepEqual(down, { ok: false, reason: 'unavailable' })
  })

  it('maps failures to 403, or 503 when Cloudflare is unreachable', async () => {
    assert.equal(turnstileFailureResponse({ ok: false, reason: 'invalid-token' }).status, 403)
    assert.equal(turnstileFailureResponse({ ok: false, reason: 'unavailable' }).status, 503)
    const body = await turnstileFailureResponse({ ok: false, reason: 'missing-token' }).json()
    assert.equal(body.code, 'turnstile_failed')
  })

  it('reads the token from JSON bodies and multipart form data', () => {
    assert.equal(readTurnstileToken({ turnstileToken: ' abc ' }), 'abc')
    assert.equal(readTurnstileToken({ turnstileToken: 5 }), '')
    const fd = new FormData()
    fd.append('turnstileToken', 'xyz')
    assert.equal(readTurnstileToken(fd), 'xyz')
    assert.equal(readTurnstileToken(null), '')
  })
})

describe('Turnstile wiring', () => {
  const routes: Array<[string, string, string]> = [
    ['src/app/api/contact/route.ts', 'contact', 'readTurnstileToken(body)'],
    ['src/app/api/consultations/route.ts', 'consultation', 'readTurnstileToken(body)'],
    ['src/app/api/credit-funding/start/route.ts', 'credit_start', 'readTurnstileToken(body)'],
    ['src/app/api/credit-funding/intake/route.ts', 'credit_intake', 'readTurnstileToken(formData)'],
  ]
  for (const [path, action, reader] of routes) {
    it(`verifies the token server-side in ${path}`, () => {
      const source = read(path)
      assert.ok(source.includes(reader))
      assert.ok(source.includes(`action: '${action}'`))
      assert.ok(source.includes('turnstileFailureResponse(human)'))
    })
  }

  it('renders the widget and sends the token from each public form', () => {
    for (const path of [
      'src/components/ContactForm.tsx',
      'src/components/contact/ConsultationBooker.tsx',
      'src/components/credit-funding/CreditFundingForm.tsx',
    ]) {
      const source = read(path)
      assert.ok(source.includes('<TurnstileWidget'), path)
      assert.ok(source.includes('turnstileToken'), path)
      assert.ok(source.includes('turnstile.current?.reset()'), `${path} resets the single-use token`)
    }
  })

  it('allows the Turnstile script and iframe in the CSP', () => {
    const script = `
      const config = require('./next.config.js')
      config.headers().then((rules) => {
        const csp = rules[0].headers.find((h) => h.key === 'Content-Security-Policy').value
        process.stdout.write(csp)
      })
    `
    const csp = execFileSync(process.execPath, ['-e', script], {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production' },
    })
    const directive = (name: string) => csp.split('; ').find((part) => part.startsWith(`${name} `)) || ''
    assert.ok(directive('script-src').split(/\s+/).includes('https://challenges.cloudflare.com'))
    assert.ok(directive('frame-src').split(/\s+/).includes('https://challenges.cloudflare.com'))
  })

  it('documents both keys in .env.example', () => {
    const env = read('.env.example')
    assert.match(env, /^NEXT_PUBLIC_TURNSTILE_SITE_KEY=$/m)
    assert.match(env, /^TURNSTILE_SECRET_KEY=$/m)
  })
})

describe('per-email limits', () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })

  it('normalizes case, whitespace and +tags into one key per inbox', () => {
    assert.equal(emailLimitKey('  Jane.Doe+promo@Example.COM '), 'jane.doe@example.com')
    assert.equal(emailLimitKey('jane.doe@example.com'), 'jane.doe@example.com')
    assert.equal(emailLimitKey('+x@example.com'), '+x@example.com')
    assert.equal(emailLimitKey('not-an-email'), 'not-an-email')
  })

  it('caps credit starts and anonymous intakes per address, across +tag variants', async () => {
    const email = `cap-${Date.now()}@example.com`
    for (let i = 0; i < CREDIT_EMAIL_LIMIT; i++) {
      const tagged = email.replace('@', `+${i}@`)
      assert.equal((await creditEmailRateLimit(tagged)).allowed, true)
    }
    assert.equal((await creditEmailRateLimit(email.toUpperCase())).allowed, false)
    assert.equal((await creditEmailRateLimit(`other-${email}`)).allowed, true)
  })

  it('caps consultation attempts per address', async () => {
    const email = `book-${Date.now()}@example.com`
    for (let i = 0; i < CONSULTATION_EMAIL_LIMIT; i++) {
      assert.equal((await consultationEmailRateLimit(email)).allowed, true)
    }
    assert.equal((await consultationEmailRateLimit(email)).allowed, false)
  })

  it('applies the credit cap on start and on anonymous intake only', () => {
    const start = read('src/app/api/credit-funding/start/route.ts')
    assert.ok(start.includes('creditEmailRateLimit(payload.email)'))
    const intake = read('src/app/api/credit-funding/intake/route.ts')
    assert.match(intake, /if \(!inviteToken && !ownedDraft\) \{\s+const perEmail = await creditEmailRateLimit\(payload\.email\)/)
  })

  it('allows one open consultation per email, checked before the slot is taken', () => {
    const service = read('src/lib/consultation-service.ts')
    const check = service.indexOf('countOpenBookingsForEmail(input.email, now)')
    const insert = service.indexOf('insertConsultationBooking({')
    assert.ok(check > 0 && check < insert)
    const db = read('src/lib/consultation-db.ts')
    assert.match(db, /countOpenBookingsForEmail[\s\S]*?\.eq\('status', 'scheduled'\)[\s\S]*?\.ilike\('guest_email', pattern\)[\s\S]*?\.gte\('ends_at'/)
    const route = read('src/app/api/consultations/route.ts')
    assert.ok(route.includes('consultationEmailRateLimit(email)'))
  })
})

describe('credit-funding/start conflict response', () => {
  it('returns one identical 409 whether an account or an application exists', () => {
    const source = read('src/app/api/credit-funding/start/route.ts')
    assert.equal(source.match(/status: 409/g), null, 'no ad-hoc 409 bodies')
    assert.equal(source.match(/CREDIT_START_CONFLICT\.body/g)?.length, 1)
    assert.match(
      source,
      /if \(\(await getUserByEmail\(payload\.email\)\) \|\| \(await getBlockingIncompleteApplicationByEmail\(payload\.email\)\)\) \{\s+return NextResponse\.json\(CREDIT_START_CONFLICT\.body, \{ status: CREDIT_START_CONFLICT\.status \}\)/
    )
    assert.doesNotMatch(source, /already exists|already has an application/)
    assert.equal(CREDIT_START_CONFLICT.status, 409)
    assert.doesNotMatch(CREDIT_START_CONFLICT.body.error, /exists|already has/)
  })
})

describe('consultation booking on an existing lead', () => {
  const now = new Date('2026-11-20T15:00:00.000Z')

  it('only changes notes and keeps what staff already wrote', () => {
    const note = consultationBookingNote({
      whenLabel: 'Tue, Nov 24 at 2:00 PM ET',
      name: 'Mallory',
      phone: '555-0100',
      business: 'Spoofed LLC',
      note: 'please call',
      now,
    })
    const update = existingLeadUpdateForBooking('Called twice, wants SEO.', note)
    assert.deepEqual(Object.keys(update), ['notes'])
    assert.ok(update.notes.startsWith('Called twice, wants SEO.\n\n[2026-11-20] Website consultation booked for Tue, Nov 24 at 2:00 PM ET.'))
    assert.match(update.notes, /unverified\): name Mallory; business Spoofed LLC; phone 555-0100\./)
    assert.match(update.notes, /Note: please call$/)
  })

  it('starts notes on an empty lead and clips oversized input', () => {
    const note = consultationBookingNote({ whenLabel: 'x', name: '', phone: '', business: '', note: 'a'.repeat(5000), now })
    assert.ok(note.length < 1000)
    assert.equal(existingLeadUpdateForBooking(null, note).notes, note)
    const huge = existingLeadUpdateForBooking('b'.repeat(30000), note)
    assert.ok(huge.notes.length <= 20000)
    assert.ok(huge.notes.endsWith(note))
  })

  it('no longer overwrites stage, status, phone, business or message', () => {
    const service = read('src/lib/consultation-service.ts')
    const branch = service.slice(service.indexOf('  } else {\n    // Unauthenticated form'), service.indexOf('let meetingId'))
    assert.ok(branch.includes('existingLeadUpdateForBooking(lead.notes, note)'))
    for (const field of ['pipeline_stage', 'marketing_lead_status', 'updates.phone', 'updates.business', 'updates.message']) {
      assert.ok(!branch.includes(field), field)
    }
    assert.ok(!service.includes('stageAfterConsultation'))
  })
})
