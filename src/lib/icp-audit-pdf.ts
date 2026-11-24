import { existsSync } from 'node:fs'
import path from 'node:path'
import PDFDocument from 'pdfkit'
import type { Audit } from '@/lib/icp-audit'
import type { AuditArea, CheckStatus } from '@/lib/icp-audit-areas'
import { OUTREACH_MAILING_ADDRESS } from '@/lib/outreach/constants'

// Brand: cream pages, paper cards, warm hairlines, ink bands, gold accents (design-rules.md).
const C = {
  cream: '#fbf7f0', paper: '#fffdf8', line: '#e6dbc6', ink: '#1b1a17', muted: '#5d5a55', soft: '#8a857d',
  gold: '#b8943f', goldText: '#7f6427', onInk: '#fbf7f0', onInkMuted: '#cfc4b0',
  good: '#2f5d2a', goodBg: '#e7efe3', bad: '#8a3b22', badBg: '#f6e3dc', unk: '#8a857d', unkBg: '#ece6da',
}
const PAGE = { w: 612, h: 792, m: 48 }
const W = PAGE.w - PAGE.m * 2
const PHONE = '(609) 400-4459'

/** Fonts cover Latin only; swap characters they can't draw. */
function safe(text: string): string {
  return text.replace(/★/g, ' stars').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7e\xa0-\xff\n–—·]/g, '')
}

function scoreColor(score: number | null): string {
  if (score == null) return C.unk
  return score >= 80 ? C.good : score >= 50 ? C.gold : C.bad
}

function scoreWord(score: number | null): string {
  if (score == null) return 'Not checked'
  return score >= 80 ? 'Strong' : score >= 50 ? 'Needs work' : 'Weak'
}

function registerFonts(doc: PDFKit.PDFDocument) {
  const dir = path.join(process.cwd(), 'src', 'assets', 'fonts')
  const fonts: Array<[string, string, string]> = [
    ['serif', 'fraunces-latin-600-normal.woff', 'Times-Bold'],
    ['sans', 'montserrat-latin-400-normal.woff', 'Helvetica'],
    ['sans-semi', 'montserrat-latin-600-normal.woff', 'Helvetica-Bold'],
    ['sans-bold', 'montserrat-latin-700-normal.woff', 'Helvetica-Bold'],
  ]
  for (const [name, file, fallback] of fonts) {
    const full = path.join(dir, file)
    try {
      doc.registerFont(name, existsSync(full) ? full : fallback)
    } catch {
      doc.registerFont(name, fallback)
    }
  }
}

function logoPath(): string | null {
  const p = path.join(process.cwd(), 'public', 'logo-white.png')
  return existsSync(p) ? p : null
}

export async function buildAuditPdf(audit: Audit, links: { auditUrl: string; bookUrl: string }): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'LETTER', margin: PAGE.m, bufferPages: true, info: { Title: `${safe(audit.business)} - free online audit`, Author: 'Sunday Harmony' } })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
  registerFonts(doc)
  const bottom = PAGE.h - 64

  const paint = () => {
    doc.save().rect(0, 0, PAGE.w, PAGE.h).fill(C.cream).restore()
    doc.y = PAGE.m
  }
  paint()
  doc.on('pageAdded', paint)
  const ensure = (h: number) => {
    if (doc.y + h > bottom) doc.addPage()
  }
  const label = (text: string, x = PAGE.m, color = C.goldText) => {
    doc.font('sans-bold').fontSize(7.5).fillColor(color).text(text.toUpperCase(), x, doc.y, { characterSpacing: 1.6, lineBreak: false })
    doc.y += 14
  }

  // ---- Cover band ----
  const bandH = 232
  doc.save().rect(0, 0, PAGE.w, bandH).fill(C.ink).restore()
  const logo = logoPath()
  if (logo) doc.image(logo, PAGE.m - 6, 26, { width: 78 })
  doc.font('sans-bold').fontSize(7.5).fillColor(C.gold)
    .text(`FREE ONLINE AUDIT  ·  ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }).toUpperCase()}`, PAGE.m, 86, { characterSpacing: 1.6 })
  doc.font('serif').fontSize(30).fillColor(C.onInk).text(safe(audit.business), PAGE.m, 104, { width: W - 170, lineGap: -2 })
  if (audit.location) doc.font('sans').fontSize(10.5).fillColor(C.onInkMuted).text(safe(audit.location), PAGE.m, doc.y + 4, { width: W - 170 })
  doc.font('sans').fontSize(9.5).fillColor(C.onInkMuted)
    .text('We checked your Google profile, website, branding, social media, marketing and systems the way a new customer would.', PAGE.m, Math.max(doc.y + 12, 178), { width: W - 180, lineGap: 1.5 })

  // Score dial
  const cx = PAGE.w - PAGE.m - 66
  const cy = 120
  const r = 54
  doc.save().lineWidth(9).strokeColor('#3a3833').circle(cx, cy, r).stroke().restore()
  if (audit.overall != null && audit.overall > 0) {
    const end = -Math.PI / 2 + (2 * Math.PI * Math.min(audit.overall, 99.9)) / 100
    const start = -Math.PI / 2
    const steps = 60
    doc.save().lineWidth(9).lineCap('round').strokeColor(C.gold)
    doc.moveTo(cx + r * Math.cos(start), cy + r * Math.sin(start))
    for (let i = 1; i <= steps; i++) {
      const a = start + ((end - start) * i) / steps
      doc.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
    }
    doc.stroke().restore()
  }
  const big = audit.overall == null ? '–' : String(audit.overall)
  doc.font('serif').fontSize(34).fillColor(C.onInk).text(big, cx - 50, cy - 24, { width: 100, align: 'center' })
  doc.font('sans-semi').fontSize(7).fillColor(C.onInkMuted).text('ONLINE SCORE', cx - 45, cy + 15, { width: 90, align: 'center', characterSpacing: 0.8, lineBreak: false })
  doc.text('OUT OF 100', cx - 45, cy + 25, { width: 90, align: 'center', characterSpacing: 0.8, lineBreak: false })

  doc.y = bandH + 26

  // ---- What is working ----
  // With the full audit, the 6 areas show the gaps, so drop the old "no major gaps" line.
  const strengths = audit.areas ? audit.strengths.filter((t) => !/^No major gaps/i.test(t)) : audit.strengths
  if (strengths.length) {
    const text = strengths.map(safe).join('\n')
    doc.font('sans').fontSize(10.5)
    const h = doc.heightOfString(text, { width: W - 40 }) + 40
    doc.save().roundedRect(PAGE.m, doc.y, W, h, 14).fill(C.paper).restore()
    doc.save().roundedRect(PAGE.m, doc.y, 4, h, 2).fill(C.gold).restore()
    const top = doc.y
    doc.y = top + 14
    label('What is working', PAGE.m + 20)
    doc.font('sans').fontSize(10.5).fillColor(C.ink).text(text, PAGE.m + 20, doc.y, { width: W - 40, lineGap: 1.5 })
    doc.y = top + h + 22
  }

  // ---- At a glance: 6 tiles ----
  if (audit.areas) {
    label('Your 6 areas at a glance')
    const cols = 3
    const gap = 12
    const tw = (W - gap * (cols - 1)) / cols
    const th = 74
    ensure(th * 2 + gap + 10)
    const top = doc.y
    audit.areas.forEach((a, i) => {
      const x = PAGE.m + (i % cols) * (tw + gap)
      const y = top + Math.floor(i / cols) * (th + gap)
      doc.save().roundedRect(x, y, tw, th, 12).fillAndStroke(C.paper, C.line).restore()
      doc.font('sans-semi').fontSize(9).fillColor(C.muted).text(a.title, x + 14, y + 12, { width: tw - 28, lineBreak: false })
      doc.font('serif').fontSize(22).fillColor(C.ink).text(a.score == null ? '–' : String(a.score), x + 14, y + 26, { width: 60, lineBreak: false })
      const word = scoreColor(a.score)
      doc.font('sans-semi').fontSize(8).fillColor(word === C.gold ? C.goldText : word).text(scoreWord(a.score), x + tw - 14 - 80, y + 36, { width: 80, align: 'right', lineBreak: false })
      const barY = y + th - 16
      doc.save().roundedRect(x + 14, barY, tw - 28, 5, 2.5).fill(C.unkBg).restore()
      if (a.score) doc.save().roundedRect(x + 14, barY, Math.max(5, ((tw - 28) * a.score) / 100), 5, 2.5).fill(scoreColor(a.score)).restore()
    })
    doc.y = top + th * 2 + gap + 26
  }

  // ---- Area details ----
  const icon = (status: CheckStatus, x: number, y: number) => {
    const fg = status === 'pass' ? C.good : status === 'fail' ? C.bad : C.unk
    const bg = status === 'pass' ? C.goodBg : status === 'fail' ? C.badBg : C.unkBg
    doc.save().circle(x + 7, y + 7, 7).fill(bg).restore()
    doc.save().lineWidth(1.6).lineCap('round').lineJoin('round').strokeColor(fg)
    if (status === 'pass') doc.moveTo(x + 3.6, y + 7.2).lineTo(x + 6.2, y + 9.6).lineTo(x + 10.6, y + 4.6).stroke()
    else if (status === 'fail') doc.moveTo(x + 4.4, y + 4.4).lineTo(x + 9.6, y + 9.6).moveTo(x + 9.6, y + 4.4).lineTo(x + 4.4, y + 9.6).stroke()
    doc.restore()
    if (status === 'unknown') doc.font('sans-bold').fontSize(8).fillColor(fg).text('?', x, y + 2.6, { width: 14, align: 'center' })
  }

  const inner = W - 40
  const checkH = (c: { label: string; note: string }) => {
    doc.font('sans-semi').fontSize(10)
    let h = doc.heightOfString(safe(c.label), { width: inner - 24 })
    if (c.note) {
      doc.font('sans').fontSize(9)
      h += 2 + doc.heightOfString(safe(c.note), { width: inner - 24 })
    }
    return h + 8
  }

  const areaCard = (area: AuditArea) => {
    const fixLine = area.score != null && area.score < 70 ? `Fixed in ${area.fixedBy}: ${area.why}` : ''
    const comps = area.key === 'marketing' ? audit.competitors : []
    doc.font('sans').fontSize(9.5)
    const fixH = fixLine ? doc.heightOfString(safe(fixLine), { width: inner }) + 22 : 0
    const compH = comps.length ? 26 + comps.length * 15 : 0
    const checksH = area.checks.reduce((s, c) => s + checkH(c), 0)
    const h = 50 + checksH + compH + fixH + 8
    ensure(Math.min(h, bottom - PAGE.m))
    const top = doc.y
    doc.save().roundedRect(PAGE.m, top, W, h, 16).fillAndStroke(C.paper, C.line).restore()
    doc.font('serif').fontSize(16).fillColor(C.ink).text(area.title, PAGE.m + 20, top + 16, { width: inner - 120 })
    const pill = `${area.score ?? '–'}/100 · ${scoreWord(area.score)}`
    doc.font('sans-bold').fontSize(8.5)
    const pw = doc.widthOfString(pill) + 20
    const color = scoreColor(area.score)
    doc.save().roundedRect(PAGE.m + W - 20 - pw, top + 15, pw, 20, 10).fill(color === C.gold ? '#f3ead6' : color === C.good ? C.goodBg : color === C.bad ? C.badBg : C.unkBg).restore()
    doc.fillColor(color === C.gold ? C.goldText : color).text(pill, PAGE.m + W - 20 - pw, top + 21, { width: pw, align: 'center' })
    let y = top + 48
    for (const c of area.checks) {
      icon(c.status, PAGE.m + 20, y + 1)
      doc.font('sans-semi').fontSize(10).fillColor(C.ink).text(safe(c.label), PAGE.m + 44, y, { width: inner - 24 })
      if (c.note) doc.font('sans').fontSize(9).fillColor(C.muted).text(safe(c.note), PAGE.m + 44, doc.y + 2, { width: inner - 24 })
      y = doc.y + 8
    }
    if (comps.length) {
      doc.save().moveTo(PAGE.m + 20, y + 2).lineTo(PAGE.m + W - 20, y + 2).lineWidth(0.6).strokeColor(C.line).stroke().restore()
      doc.y = y + 10
      label('Nearby competitors on Google', PAGE.m + 20)
      y = doc.y
      for (const comp of comps) {
        doc.font('sans').fontSize(9.5).fillColor(C.ink).text(safe(comp.name), PAGE.m + 20, y, { width: inner - 150, lineBreak: false, ellipsis: true })
        doc.fillColor(C.muted).text(`${comp.rating ?? '–'} stars  ·  ${comp.reviews ?? 0} reviews`, PAGE.m + W - 170, y, { width: 150, align: 'right' })
        y += 15
      }
    }
    if (fixLine) {
      doc.save().moveTo(PAGE.m + 20, y + 4).lineTo(PAGE.m + W - 20, y + 4).lineWidth(0.6).strokeColor(C.line).stroke().restore()
      doc.font('sans-bold').fontSize(9.5).fillColor(C.goldText).text(`Fixed in ${area.fixedBy}: `, PAGE.m + 20, y + 14, { width: inner, continued: true })
        .font('sans').fillColor(C.ink).text(safe(area.why))
    }
    doc.y = top + h + 14
  }

  if (audit.areas) {
    // Top 3 fixes: the first failing checks, most visible areas first.
    const order = ['website', 'google', 'systems', 'marketing', 'social', 'branding']
    const top3 = order
      .flatMap((k) => audit.areas!.filter((a) => a.key === k).flatMap((a) => a.checks.filter((c) => c.status === 'fail').map((c) => ({ c, a }))))
      .slice(0, 3)
    if (top3.length) {
      doc.font('sans').fontSize(9.5)
      const rows = top3.map(({ c, a }) => ({ c, a, h: Math.max(28, doc.heightOfString(safe(c.note), { width: W - 196 }) + 18) }))
      const boxH = 44 + rows.reduce((sum, r) => sum + r.h, 0) + 8
      ensure(boxH)
      const t = doc.y
      doc.save().roundedRect(PAGE.m, t, W, boxH, 16).fillAndStroke(C.paper, C.line).restore()
      doc.y = t + 18
      label('Fix these first', PAGE.m + 20)
      let y = doc.y + 2
      rows.forEach(({ c, a, h }, i) => {
        doc.font('serif').fontSize(18).fillColor(C.gold).text(String(i + 1), PAGE.m + 20, y - 2, { width: 18, lineBreak: false })
        doc.font('sans-semi').fontSize(10.5).fillColor(C.ink).text(safe(c.label), PAGE.m + 44, y, { width: W - 196 })
        doc.font('sans').fontSize(9.5).fillColor(C.muted).text(safe(c.note), PAGE.m + 44, doc.y + 1, { width: W - 196 })
        doc.font('sans-semi').fontSize(8.5).fillColor(C.goldText).text(a.fixedBy, PAGE.m + W - 140, y + 2, { width: 120, align: 'right' })
        y += h
      })
      doc.y = t + boxH + 22
    }
    doc.addPage()
    label('The details')
    doc.font('serif').fontSize(22).fillColor(C.ink).text('What we checked', PAGE.m, doc.y)
    doc.y += 12
    audit.areas.forEach(areaCard)
  } else {
    label(audit.findings.length ? `What we found (${audit.findings.length})` : 'What we found')
    if (!audit.findings.length) doc.font('sans').fontSize(10.5).fillColor(C.ink).text('No major gaps on your website or Google profile.', PAGE.m, doc.y, { width: W })
    for (const f of audit.findings) {
      areaCard({ key: 'google', title: f.title, score: null, fixedBy: 'Business Essentials', why: f.fix, checks: [{ label: f.title, status: 'fail', note: f.detail }] })
    }
  }

  // ---- Plan band + call to action ----
  const steps = audit.plan.length ? audit.plan : [{ name: audit.nextStep.name, areas: [] as string[], why: [audit.nextStep.detail] }]
  const stepH = (st: { name: string; areas: string[]; why: string[] }) => {
    doc.font('serif').fontSize(15)
    let h = doc.heightOfString(st.name, { width: W - 88 }) + 1
    if (st.areas.length) h += 12
    doc.font('sans').fontSize(10)
    for (const w of st.why) h += doc.heightOfString(safe(w), { width: W - 88, lineGap: 1 }) + 3
    return h + 14
  }
  const planH = 24 + 14 + 26 + 12 + steps.reduce((sum, st) => sum + stepH(st), 0) + 6 + 34 + 28
  ensure(planH)
  const pTop = doc.y
  doc.save().roundedRect(PAGE.m, pTop, W, planH, 18).fill(C.ink).restore()
  doc.y = pTop + 24
  label(audit.plan.length ? 'Your plan' : 'Suggested next step', PAGE.m + 28, C.gold)
  doc.font('serif').fontSize(20).fillColor(C.onInk).text('How Sunday Harmony fixes this', PAGE.m + 28, doc.y, { width: W - 56 })
  doc.y += 12
  steps.forEach((st, i) => {
    const y = doc.y
    doc.save().circle(PAGE.m + 40, y + 10, 11).fill(C.gold).restore()
    doc.font('sans-bold').fontSize(10).fillColor(C.ink).text(String(i + 1), PAGE.m + 29, y + 4.5, { width: 22, align: 'center' })
    doc.font('serif').fontSize(15).fillColor(C.onInk).text(st.name, PAGE.m + 60, y + 1, { width: W - 88 })
    if (st.areas.length) doc.font('sans-bold').fontSize(7.5).fillColor(C.gold).text(`FIXES: ${st.areas.join('  ·  ').toUpperCase()}`, PAGE.m + 60, doc.y + 2, { width: W - 88, characterSpacing: 1 })
    for (const w of st.why) doc.font('sans').fontSize(10).fillColor(C.onInkMuted).text(safe(w), PAGE.m + 60, doc.y + 3, { width: W - 88, lineGap: 1 })
    doc.y += 14
  })
  // CTA button
  const btnY = doc.y + 6
  const btnText = 'Book your free 30-minute call'
  doc.font('sans-bold').fontSize(10.5)
  const bw = doc.widthOfString(btnText) + 44
  doc.save().roundedRect(PAGE.m + 28, btnY, bw, 34, 17).fill(C.gold).restore()
  doc.fillColor(C.ink).text(btnText, PAGE.m + 28, btnY + 11, { width: bw, align: 'center', link: links.bookUrl })
  doc.link(PAGE.m + 28, btnY, bw, 34, links.bookUrl)
  doc.font('sans').fontSize(10).fillColor(C.onInkMuted).text(`or call ${PHONE}  ·  No contract.`, PAGE.m + 28 + bw + 16, btnY + 11, { width: W - bw - 72 })
  doc.y = pTop + planH + 18

  // ---- Fine print ----
  ensure(50)
  doc.font('sans').fontSize(7.5).fillColor(C.soft)
    .text('We checked your public Google listing, website and nearby businesses on Google. Results are a snapshot and can change. No results are guaranteed.', PAGE.m, doc.y, { width: W })
  doc.text(`Online version: ${links.auditUrl}`, { width: W, link: links.auditUrl })

  // ---- Footers ----
  const range = doc.bufferedPageRange()
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i)
    doc.page.margins.bottom = 0 // footer sits below the text area; don't let it start a new page
    doc.save().moveTo(PAGE.m, PAGE.h - 42).lineTo(PAGE.w - PAGE.m, PAGE.h - 42).lineWidth(0.6).strokeColor(C.line).stroke().restore()
    doc.font('sans').fontSize(7.5).fillColor(C.soft)
      .text(`Sunday Harmony Consulting  ·  sundayharmony.com  ·  ${PHONE}  ·  ${OUTREACH_MAILING_ADDRESS}`, PAGE.m, PAGE.h - 34, { width: W - 60, lineBreak: false })
      .text(`${i + 1} / ${range.count}`, PAGE.w - PAGE.m - 60, PAGE.h - 34, { width: 60, align: 'right', lineBreak: false })
  }
  doc.end()
  return done
}
