const fs = require('fs')
const { Client } = require('pg')

async function main() {
  const sql = fs.readFileSync('supabase-migration-008-credit-funding.sql', 'utf8')
  const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
  if (!connectionString) {
    console.error('POSTGRES_URL not available')
    process.exit(1)
  }
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  await client.connect()
  await client.query(sql)
  const check = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('credit_funding_applications', 'uploaded_documents')"
  )
  console.log('Migration OK:', check.rows.map((r) => r.table_name).join(', '))
  await client.end()
}

main().catch((err) => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
