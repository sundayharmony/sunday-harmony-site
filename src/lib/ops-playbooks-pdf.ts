import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import PDFDocument from 'pdfkit'

const OPS_DIR_CANDIDATES = [
  join(process.cwd(), 'services/dispute-letters-api/knowledge/ops'),
  join(process.cwd(), '../services/dispute-letters-api/knowledge/ops'),
]

export function resolveOpsDir(): string | null {
  for (const dir of OPS_DIR_CANDIDATES) {
    if (existsSync(dir)) return dir
  }
  return null
}

export function listOpsPlaybookFiles(dir = resolveOpsDir()): string[] {
  if (!dir) return []
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort((a, b) => {
      if (a === 'ops-digest.md') return -1
      if (b === 'ops-digest.md') return 1
      return a.localeCompare(b)
    })
    .map((name) => join(dir, name))
}

function stripMd(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trimEnd()
}

/** Build an admin-only staff PDF from ops playbook markdown (no public asset path). */
export async function buildOpsPlaybooksPdf(options?: {
  files?: string[]
}): Promise<Buffer> {
  const files = options?.files || listOpsPlaybookFiles()
  if (!files.length) {
    throw new Error('No ops playbook markdown files found')
  }

  const doc = new PDFDocument({ margin: 50, size: 'LETTER', info: { Title: 'Sunday Harmony — Credit Ops Playbooks (Staff Only)' } })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  doc.fontSize(18).text('Sunday Harmony — Credit Ops Playbooks', { align: 'left' })
  doc.moveDown(0.3)
  doc.fontSize(10).fillColor('#444').text('ADMIN ONLY — not for client portal or public distribution.', { align: 'left' })
  doc.moveDown(0.5)
  doc.fontSize(9).fillColor('#666').text(`Generated ${new Date().toISOString().slice(0, 10)}. Source: services/dispute-letters-api/knowledge/ops/`)
  doc.moveDown(1)
  doc.fillColor('#000')

  for (const file of files) {
    const raw = readFileSync(file, 'utf8')
    const title = stripMd(raw.split('\n').find((l) => l.startsWith('#')) || file.split('/').pop() || 'Playbook')
    doc.addPage()
    doc.fontSize(14).text(title, { align: 'left' })
    doc.moveDown(0.6)
    doc.fontSize(9)
    for (const line of raw.split('\n')) {
      if (line.startsWith('```')) continue
      const text = stripMd(line)
      if (!text) {
        doc.moveDown(0.25)
        continue
      }
      if (line.startsWith('#')) {
        doc.moveDown(0.4)
        doc.fontSize(11).text(text)
        doc.fontSize(9)
        continue
      }
      doc.text(text, { width: 512 })
    }
  }

  doc.end()
  return done
}

/** Test helper: write PDF to a temp path. */
export async function writeOpsPlaybooksPdfToTemp(): Promise<string> {
  const buf = await buildOpsPlaybooksPdf()
  const path = join(tmpdir(), `ops-playbooks-staff-${Date.now()}.pdf`)
  writeFileSync(path, buf)
  return path
}
