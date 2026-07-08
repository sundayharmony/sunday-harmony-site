import fs from 'fs'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'

function loadEnv(file) {
  const env = {}
  if (!fs.existsSync(file)) return env
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '')
  }
  return env
}

const env = { ...loadEnv('.env.local') }
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const sessionId = randomUUID()
const objectPath = `sessions/${sessionId}/report/credit_report.txt`
const fileBytes = Buffer.from('CONSUMER: John Doe\nACCOUNT: Test Bank\nSTATUS: Late')

const signed = await supabase.storage.from('dispute-letters').createSignedUploadUrl(objectPath)
const put = await fetch(signed.data.signedUrl, {
  method: 'PUT',
  headers: {
    'Content-Type': 'text/plain',
    Authorization: `Bearer ${signed.data.token}`,
    'x-upsert': 'false',
  },
  body: fileBytes,
})
console.log('put', put.status)

await supabase.from('dispute_sessions').insert({
  id: sessionId,
  admin_user_id: 'debug@test.local',
  status: 'uploaded',
  storage_path: objectPath,
  file_name: 'credit_report.txt',
  file_type: '',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})

const secret = fs.readFileSync('.dispute-secret.tmp', 'utf8').trim()
const analyze = await fetch('https://dispute-letters-api-production.up.railway.app/internal/analyze/stream', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${secret}`,
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  },
  body: JSON.stringify({
    session_id: sessionId,
    storage_path: objectPath,
    file_name: 'credit_report.txt',
  }),
})
console.log('analyze', analyze.status, (await analyze.text()).slice(0, 500))

await supabase.from('dispute_sessions').delete().eq('id', sessionId)
await supabase.storage.from('dispute-letters').remove([objectPath])
