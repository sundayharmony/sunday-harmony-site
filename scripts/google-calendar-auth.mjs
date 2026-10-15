/**
 * One-time consent for the consultation calendar.
 *
 *   GOOGLE_CALENDAR_CLIENT_ID=... GOOGLE_CALENDAR_CLIENT_SECRET=... node scripts/google-calendar-auth.mjs
 *
 * In Google Cloud, the OAuth client must allow this redirect:
 *   http://127.0.0.1:53682/oauth
 *
 * Sign in as the mailbox that should own the Meet events (sales@sundayharmony.com).
 */
import { createServer } from 'node:http'

const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim()
const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim()
const redirect = 'http://127.0.0.1:53682/oauth'

if (!clientId || !clientSecret) {
  console.error('Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET first.')
  process.exit(1)
}

const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth')
auth.searchParams.set('client_id', clientId)
auth.searchParams.set('redirect_uri', redirect)
auth.searchParams.set('response_type', 'code')
auth.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.events')
auth.searchParams.set('access_type', 'offline')
auth.searchParams.set('prompt', 'consent')

console.log('Open this URL in a browser while signed in as the calendar owner:\n')
console.log(auth.toString())
console.log('\nWaiting on http://127.0.0.1:53682/oauth …')

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', redirect)
  if (url.pathname !== '/oauth') {
    res.statusCode = 404
    res.end('Not found')
    return
  }
  const code = url.searchParams.get('code')
  const oauthError = url.searchParams.get('error')
  if (!code) {
    res.end(oauthError ? `Google returned: ${oauthError}` : 'Missing code')
    return
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirect,
      grant_type: 'authorization_code',
    }),
  })
  const json = await tokenRes.json()
  res.end('Sunday Harmony received the code. You can close this tab and return to the terminal.')
  if (!tokenRes.ok || !json.refresh_token) {
    console.error('\nToken exchange failed. If you already consented, remove Sunday Harmony access at https://myaccount.google.com/permissions and run this again.')
    console.error(json)
  } else {
    console.log('\nGOOGLE_CALENDAR_REFRESH_TOKEN=')
    console.log(json.refresh_token)
    console.log('\nSet GOOGLE_CALENDAR_ID to the mailbox, usually sales@sundayharmony.com or primary.')
  }
  server.close()
  process.exit(tokenRes.ok && json.refresh_token ? 0 : 1)
})

server.listen(53682, '127.0.0.1')
