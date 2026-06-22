import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

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
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const checks = [
  ['009', 'credit_funding_status_history'],
  ['010', 'client_meetings'],
  ['010_lead_type', null],
]

const { error: hErr } = await sb.from('credit_funding_status_history').select('id').limit(1)
console.log('009:', hErr ? 'pending' : 'ready')

const { error: mErr } = await sb.from('client_meetings').select('id').limit(1)
console.log('010:', mErr ? 'pending' : 'ready')

const { data: leadSample, error: lErr } = await sb.from('leads').select('lead_type').limit(1)
console.log('010_lead_type:', lErr || !leadSample?.length ? 'unknown' : (leadSample[0].lead_type != null ? 'ready' : 'pending'))
