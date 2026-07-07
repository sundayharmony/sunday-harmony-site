import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv(file) {
  const env = {}
  if (!fs.existsSync(file)) return env
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '')
  }
  return env
}

const env = { ...loadEnv('.env.local'), ...loadEnv('.env.verify-prod') }
const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
console.log('supabase_url', url)
console.log('service_role_len', key?.length || 0)

if (!url || !key) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(url, key)

const sessions = await supabase
  .from('dispute_sessions')
  .select('id,status,file_name,error_message,created_at')
  .order('created_at', { ascending: false })
  .limit(5)
console.log(
  'recent_sessions',
  sessions.error?.message || sessions.data?.map((s) => ({ status: s.status, file: s.file_name, err: s.error_message })) || []
)

const bucket = await supabase.storage.listBuckets()
const disputeBucket = bucket.data?.find((b) => b.id === 'dispute-letters')
console.log('dispute_letters_bucket', disputeBucket ? { id: disputeBucket.id, public: disputeBucket.public } : 'MISSING')
