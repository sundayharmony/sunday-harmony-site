import fs from 'fs'
import { Resend } from 'resend'

function loadEnvLocal() {
  const text = fs.readFileSync('.env.local', 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)="(.*)"/)
    if (m) env[m[1]] = m[2]
  }
  return env
}

const env = loadEnvLocal()
const apiKey = env.RESEND_API_KEY
if (!apiKey) {
  console.error('RESEND_API_KEY missing in .env.local')
  process.exit(1)
}

const endpoint = env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') + '/api/resend/webhook'
const resend = new Resend(apiKey)

const { data: existing } = await resend.webhooks.list()
const match = existing?.data?.find((w) => w.endpoint === endpoint)
if (match) {
  console.log('EXISTS', match.id)
  process.exit(0)
}

const { data, error } = await resend.webhooks.create({
  endpoint,
  events: ['email.received'],
})

if (error || !data) {
  console.error('CREATE_FAILED', error?.message || 'unknown')
  process.exit(1)
}

console.log('CREATED', data.id)
console.log('SECRET', data.signing_secret)
