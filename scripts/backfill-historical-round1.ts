/**
 * Backfill a mailed Round 1 from the original 3-bureau report.
 * Usage:
 *   npx tsx scripts/backfill-historical-round1.ts
 *   npx tsx scripts/backfill-historical-round1.ts --name "Mike Webb"
 *   npx tsx scripts/backfill-historical-round1.ts --applicationUuid <uuid>
 */
import fs from 'node:fs'
import { backfillHistoricalRound1ForApplication, findApplicationUuidByConsumerName } from '../src/lib/dispute-letters/dispute-lifecycle-db'

function loadEnv(file: string) {
  const env: Record<string, string> = {}
  if (!fs.existsSync(file)) return env
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (!match) continue
    env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}

function argValue(flag: string): string {
  const index = process.argv.indexOf(flag)
  if (index === -1) return ''
  return String(process.argv[index + 1] || '').trim()
}

const fileEnv = { ...loadEnv('.env.local'), ...loadEnv('.env.verify-prod') }
for (const [key, value] of Object.entries(fileEnv)) {
  if (!process.env[key]) process.env[key] = value
}

async function main() {
  const name = argValue('--name') || 'Mike Webb'
  const applicationUuid = argValue('--applicationUuid')
  const preferredReportDate = argValue('--reportDate') || '2026-07-24'

  const uuid = applicationUuid || (await findApplicationUuidByConsumerName(name))
  if (!uuid) {
    console.error(`No application found for ${name}`)
    process.exit(1)
  }

  const result = await backfillHistoricalRound1ForApplication({
    applicationUuid: uuid,
    preferredReportDate,
  })
  if (!result.ok) {
    console.error(result.error)
    process.exit(1)
  }
  console.log(JSON.stringify(result.summary, null, 2))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
