import fs from 'fs'
import { execSync } from 'child_process'

const t = fs.readFileSync('.env.railway-deploy', 'utf8')
const m = t.match(/DISPUTE_LETTERS_API_SECRET="([^"]+)"/)
if (!m) {
  console.error('DISPUTE_LETTERS_API_SECRET not found in .env.railway-deploy')
  process.exit(1)
}
const secret = m[1]
try {
  execSync('vercel env rm DISPUTE_LETTERS_API_SECRET preview --yes', { stdio: 'pipe' })
} catch {
  /* ignore */
}
execSync('vercel env add DISPUTE_LETTERS_API_SECRET preview --yes --force', { input: secret })
console.log('preview DISPUTE_LETTERS_API_SECRET set')
