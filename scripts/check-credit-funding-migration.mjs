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
const { error } = await sb.from('credit_funding_applications').select('id').limit(1)
console.log(error ? 'pending' : 'ready')
