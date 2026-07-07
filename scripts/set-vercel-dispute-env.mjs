import fs from 'fs'
import { execSync } from 'child_process'

const secret = fs.readFileSync('.dispute-secret.tmp', 'utf8').trim()
const url = fs.readFileSync('.dispute-railway-url.tmp', 'utf8').trim()

function setEnv(name, value, env) {
  try {
    execSync(`vercel env rm ${name} ${env} --yes`, { stdio: 'pipe' })
  } catch {
    /* ignore */
  }
  execSync(`vercel env add ${name} ${env} --yes --force`, { input: value })
  console.log(`Set ${name} for ${env}`)
}

if (!fs.existsSync('.dispute-railway-url.tmp')) {
  fs.writeFileSync('.dispute-railway-url.tmp', 'https://dispute-letters-api-production.up.railway.app')
}

const railwayUrl = fs.readFileSync('.dispute-railway-url.tmp', 'utf8').trim()

for (const env of ['production', 'preview', 'development']) {
  setEnv('DISPUTE_LETTERS_API_URL', railwayUrl, env)
  setEnv('DISPUTE_LETTERS_API_SECRET', secret, env)
}

console.log('Vercel env updated. URL:', railwayUrl)
