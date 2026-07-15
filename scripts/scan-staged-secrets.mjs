import { execFileSync } from 'node:child_process'

const tokenRules = [
  {
    name: 'Supabase secret key',
    pattern: new RegExp(`\\b${['sb', 'secret'].join('_')}_[A-Za-z0-9._-]{12,}\\b`),
  },
  {
    name: 'Stripe secret key',
    pattern: new RegExp(`\\b${['s', 'k'].join('')}_(?:live|test)_[A-Za-z0-9]{12,}\\b`),
  },
  {
    name: 'Stripe webhook secret',
    pattern: new RegExp(`\\b${['wh', 'sec'].join('')}_[A-Za-z0-9]{12,}\\b`),
  },
  {
    name: 'JWT',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  },
  {
    name: 'credentialed PostgreSQL URL',
    pattern: /\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s/]+@/i,
  },
  {
    name: 'Google API key',
    pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/,
  },
  {
    name: 'GitHub token',
    pattern: new RegExp(`\\b${['g', 'h'].join('')}[pousr]_[A-Za-z0-9]{20,}\\b`),
  },
  {
    name: 'private key',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
]

const sensitiveAssignment = new RegExp(
  String.raw`^\s*(?:export\s+)?(?:SUPABASE_(?:SECRET|SERVICE_ROLE)_KEY|STRIPE_(?:SECRET_KEY|WEBHOOK_SECRET)|POSTGRES_PASSWORD|DATABASE_URL|NEXTAUTH_SECRET|SMTP_PASS|UPSTASH_REDIS_REST_TOKEN|DISPUTE_LETTERS_API_SECRET|CREDIT_FUNDING_(?:ENCRYPTION_KEY|SIGNING_SECRET)|ADMIN_PASSWORD|SETUP_TOKEN|GOOGLE_PLACES_API_KEY|GEMINI_API_KEY|CURSOR_API_KEY)\s*=\s*(.*?)\s*$`,
  'i'
)

const placeholderPattern =
  /^(?:["']?)?(?:your[-_]|change-me|generate-|replace-me|example|placeholder|(?:sk_(?:test|live)|whsec)_x+\b|xxx\b|<.+>|\$\{.+\})(?:.*)?(?:["']?)?$/i

function detectSecret(line) {
  const assignment = line.match(sensitiveAssignment)
  if (assignment) {
    const value = assignment[1].trim().replace(/^["']|["']$/g, '')
    return !value || placeholderPattern.test(value)
      ? null
      : 'sensitive environment variable'
  }

  return tokenRules.find((rule) => rule.pattern.test(line))?.name || null
}

function runSelfTest() {
  const postgresProtocol = ['post', 'gresql'].join('')
  const shouldDetect = [
    `${['sb', 'secret'].join('_')}_${'a'.repeat(32)}`,
    `${['s', 'k'].join('')}_live_${'b'.repeat(24)}`,
    `NEXTAUTH_SECRET=${'c'.repeat(32)}`,
    `${postgresProtocol}://user:${'d'.repeat(20)}@db.example.test/app`,
  ]
  const shouldAllow = [
    'SUPABASE_SECRET_KEY=your-supabase-secret-key',
    'STRIPE_SECRET_KEY=sk_test_xxx',
    'NEXTAUTH_SECRET=generate-a-random-secret-here',
    'SETUP_TOKEN=',
  ]

  if (shouldDetect.some((line) => !detectSecret(line))) {
    throw new Error('Secret scanner self-test failed to detect a credential fixture.')
  }
  const rejectedPlaceholder = shouldAllow.findIndex((line) => detectSecret(line))
  if (rejectedPlaceholder !== -1) {
    throw new Error(
      `Secret scanner self-test rejected placeholder fixture ${rejectedPlaceholder + 1}.`
    )
  }

  console.log('Secret scanner self-test passed.')
}

function stagedPaths() {
  const output = execFileSync(
    'git',
    ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'],
    { encoding: 'utf8' }
  )
  return output.split('\0').filter(Boolean)
}

function stagedContent(path) {
  return execFileSync('git', ['show', `:${path}`], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  })
}

if (process.argv.includes('--self-test')) {
  runSelfTest()
  process.exit(0)
}

const findings = []

for (const path of stagedPaths()) {
  let content
  try {
    content = stagedContent(path)
  } catch {
    console.error(`Could not inspect staged file: ${path}`)
    process.exit(2)
  }

  if (content.includes('\0')) continue

  content.split(/\r?\n/).forEach((line, index) => {
    const kind = detectSecret(line)
    if (kind) findings.push({ path, line: index + 1, kind })
  })
}

if (findings.length > 0) {
  console.error('Potential secrets found in staged files:')
  for (const finding of findings) {
    console.error(`- ${finding.path}:${finding.line} (${finding.kind})`)
  }
  console.error('Remove the credential from the staged content before committing.')
  process.exit(1)
}

console.log('No potential secrets found in staged files.')
