import PDFDocument from 'pdfkit'
import type { Audit } from '@/lib/icp-audit'
import { OUTREACH_MAILING_ADDRESS } from '@/lib/outreach/constants'

const C = { cream: '#fbf7f0', paper: '#fffdf8', line: '#e6dbc6', ink: '#1b1a17', muted: '#5d5a55', gold: '#b8943f', goldText: '#7f6427' }

/** PDFKit's built-in fonts only cover WinAnsi; swap characters it can't draw. */
function safe(text: string): string {
  return text.replace(/[★]/g, '*').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7e\xa0-\xff\n]/g, '')
}

export async function buildAuditPdf(audit: Audit, links: { auditUrl: string; bookUrl: string }): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'LETTER', margin: 56, info: { Title: `${safe(audit.business)} - free online audit`, Author: 'Sunday Harmony' } })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
  const width = doc.page.width - 112
  const paintPage = () => doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.cream)
  paintPage()
  doc.on('pageAdded', paintPage)

  const label = (text: string) => {
    doc.moveDown(0.8).font('Helvetica-Bold').fontSize(8).fillColor(C.goldText).text(text.toUpperCase(), { characterSpacing: 1.6 })
    doc.moveDown(0.4)
  }

  doc.font('Helvetica-Bold').fontSize(8).fillColor(C.goldText).text('SUNDAY HARMONY  ·  FREE ONLINE AUDIT', { characterSpacing: 1.6 })
  doc.moveDown(0.6).font('Times-Bold').fontSize(28).fillColor(C.ink).text(safe(audit.business), { width })
  if (audit.location) doc.moveDown(0.2).font('Helvetica').fontSize(11).fillColor(C.muted).text(safe(audit.location))
  doc.moveDown(0.6).moveTo(56, doc.y).lineTo(56 + width, doc.y).lineWidth(1).strokeColor(C.gold).stroke()

  if (audit.strengths.length) {
    label('What is working')
    for (const s of audit.strengths) doc.font('Helvetica').fontSize(11).fillColor(C.ink).text(safe(s), { width })
  }

  if (audit.areas) {
    label('Your online score')
    doc.font('Times-Bold').fontSize(30).fillColor(C.ink).text(`${audit.overall ?? '-'}/100`, 56, doc.y)
    doc.font('Helvetica').fontSize(10).fillColor(C.muted).text('Average of your Google profile, website, branding, social media, marketing and systems.', { width })
    const mark = { pass: '[ok]', fail: '[x]', unknown: '[?]' } as const
    for (const area of audit.areas) {
      if (doc.y > doc.page.height - 200) doc.addPage()
      label(`${area.title}  ·  ${area.score ?? '-'}/100`)
      for (const c of area.checks) {
        if (doc.y > doc.page.height - 90) doc.addPage()
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor(c.status === 'fail' ? '#8a3b22' : c.status === 'pass' ? '#2f5d2a' : C.muted)
          .text(`${mark[c.status]} `, 56, doc.y, { continued: true }).fillColor(C.ink).text(safe(c.label), { width })
        if (c.note) doc.font('Helvetica').fontSize(9.5).fillColor(C.muted).text(safe(c.note), 76, doc.y, { width: width - 20 })
        doc.x = 56
      }
      if (area.key === 'marketing' && audit.competitors.length) {
        doc.moveDown(0.3).font('Helvetica-Bold').fontSize(9).fillColor(C.goldText).text('NEARBY COMPETITORS ON GOOGLE', 56, doc.y)
        for (const comp of audit.competitors) doc.font('Helvetica').fontSize(9.5).fillColor(C.ink).text(safe(`${comp.name}: ${comp.rating ?? '-'} stars, ${comp.reviews ?? 0} reviews`), { width })
      }
      if (area.score != null && area.score < 70) {
        doc.moveDown(0.3).font('Helvetica-Bold').fontSize(10).fillColor(C.ink).text(`Fixed in ${area.fixedBy}: `, 56, doc.y, { continued: true }).font('Helvetica').text(safe(area.why), { width })
      }
    }
  } else {
    label(audit.findings.length ? `What we found (${audit.findings.length})` : 'What we found')
    if (!audit.findings.length) doc.font('Helvetica').fontSize(11).fillColor(C.ink).text('No major gaps on your website or Google profile.', { width })
    audit.findings.forEach((f, i) => {
      if (doc.y > doc.page.height - 160) doc.addPage()
      const top = doc.y
      doc.font('Times-Bold').fontSize(14).fillColor(C.ink).text(`${i + 1}. ${safe(f.title)}`, 72, top + 12, { width: width - 32 })
      doc.moveDown(0.3).font('Helvetica').fontSize(10.5).fillColor(C.muted).text(safe(f.detail), { width: width - 32 })
      doc.moveDown(0.3).font('Helvetica-Bold').fontSize(10.5).fillColor(C.ink).text('Fix: ', { continued: true }).font('Helvetica').text(safe(f.fix), { width: width - 32 })
      const bottom = doc.y + 12
      doc.roundedRect(56, top, width, bottom - top, 14).lineWidth(1).strokeColor(C.line).stroke()
      doc.x = 56
      doc.y = bottom + 10
    })
  }

  if (doc.y > doc.page.height - 180) doc.addPage()
  if (audit.plan.length) {
    label('Your plan')
    audit.plan.forEach((step, i) => {
      if (doc.y > doc.page.height - 120) doc.addPage()
      doc.font('Times-Bold').fontSize(15).fillColor(C.ink).text(`${i + 1}. ${step.name}`, 56, doc.y, { width })
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.goldText).text(`FIXES: ${step.areas.join('  ·  ').toUpperCase()}`, { width, characterSpacing: 0.8 })
      for (const w of step.why) doc.font('Helvetica').fontSize(10.5).fillColor(C.ink).text(safe(w), { width })
      doc.moveDown(0.5)
    })
  } else {
    label('Suggested next step')
    doc.font('Times-Bold').fontSize(16).fillColor(C.ink).text(audit.nextStep.name, 56, doc.y, { width })
    doc.moveDown(0.2).font('Helvetica').fontSize(11).fillColor(C.ink).text(safe(audit.nextStep.detail), { width })
  }
  doc.moveDown(0.6).fontSize(11).text('Want help with any of this? Book a free 30-minute call and we will walk through it with you. No contract.', { width })
  doc.moveDown(0.4).font('Helvetica-Bold').fillColor(C.goldText).text(links.bookUrl, { link: links.bookUrl, underline: true })

  doc.moveDown(1.2).font('Helvetica').fontSize(8.5).fillColor(C.muted)
    .text('We checked your public Google listing and website. Results are a snapshot and can change. No results are guaranteed.', { width })
  doc.moveDown(0.3).text(`Online version: ${links.auditUrl}`, { width, link: links.auditUrl })
  doc.moveDown(0.3).text(`Sunday Harmony Consulting · sales@sundayharmony.com · ${OUTREACH_MAILING_ADDRESS}`, { width })
  doc.end()
  return done
}
