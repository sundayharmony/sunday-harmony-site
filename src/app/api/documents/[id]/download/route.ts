import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getServiceDocument, type ServiceDocument } from '@/lib/service-documents'
import { isAdminRole, isStaffRole } from '@/lib/stripe-admin-auth'
import { packages } from '@/lib/data'
import PDFDocument from 'pdfkit'

export const dynamic = 'force-dynamic'

function generatePDF(document: ServiceDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 })
    
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    
    const pkg = packages.find(p => p.tier === document.package_tier)
    const docTypeLabel = document.document_type === 'agreement' ? 'SERVICE AGREEMENT' : 'MARKETING PROPOSAL'
    
    // Header
    doc.fillColor('#c9a96e')
       .fontSize(24)
       .font('Helvetica-Bold')
       .text('SUNDAY HARMONY', { align: 'center' })
    
    doc.moveDown(0.5)
       .fillColor('#333')
       .fontSize(18)
       .text(docTypeLabel, { align: 'center' })
    
    doc.moveDown(0.3)
       .fillColor('#666')
       .fontSize(10)
       .font('Helvetica')
       .text(`Document #${document.document_number}`, { align: 'center' })
    
    // Horizontal line
    doc.moveDown(1)
       .strokeColor('#c9a96e')
       .lineWidth(2)
       .moveTo(50, doc.y)
       .lineTo(562, doc.y)
       .stroke()
    
    doc.moveDown(1.5)
    
    // Document details
    doc.fillColor('#333')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('PARTIES', { underline: true })
    
    doc.moveDown(0.5)
       .font('Helvetica')
       .fontSize(11)
       .text(`Client: ${document.client_name}`)
       .text(`Business: ${document.business_name}`)
    if (document.business_address) {
      doc.text(`Address: ${document.business_address}`)
    }
    doc.text(`Email: ${document.client_email}`)
    
    doc.moveDown(1)
       .font('Helvetica-Bold')
       .fontSize(12)
       .text('SELECTED PACKAGE', { underline: true })
    
    doc.moveDown(0.5)
       .font('Helvetica')
       .fontSize(11)
       .text(`Package: ${document.package_tier}`)
       .text(`Investment: $${document.package_price.toLocaleString()}${document.price_type === 'monthly' ? '/month' : document.price_type === 'one-time' ? ' (one-time)' : ' (custom)'}`)
    
    if (document.effective_date) {
      doc.text(`Effective Date: ${new Date(document.effective_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`)
    }
    
    // Package features
    if (pkg) {
      doc.moveDown(1)
         .font('Helvetica-Bold')
         .fontSize(12)
         .text('INCLUDED SERVICES', { underline: true })
      
      doc.moveDown(0.5)
         .font('Helvetica')
         .fontSize(10)
      
      pkg.features.filter(f => f.included).forEach(feature => {
        doc.text(`  • ${feature.text}`)
      })
    }
    
    // Custom scope if any
    if (document.custom_scope) {
      doc.moveDown(1)
         .font('Helvetica-Bold')
         .fontSize(12)
         .text('SCOPE NOTES', { underline: true })
      
      doc.moveDown(0.5)
         .font('Helvetica')
         .fontSize(10)
         .text(document.custom_scope, { width: 500 })
    }
    
    // Standard terms
    doc.moveDown(1.5)
       .font('Helvetica-Bold')
       .fontSize(12)
       .text('TERMS & CONDITIONS', { underline: true })
    
    doc.moveDown(0.5)
       .font('Helvetica')
       .fontSize(9)
       .fillColor('#444')
    
    const terms = [
      'Printing, hosting, ad spend, and video production are not included unless separately quoted.',
      'Payment is due according to the agreed schedule. Monthly packages may be cancelled with 30 days notice.',
      'Client agrees to provide necessary materials, access, and feedback in a timely manner.',
      'Sunday Harmony retains portfolio rights to showcase completed work unless otherwise agreed.',
      'This agreement constitutes the entire understanding between the parties.',
    ]
    
    terms.forEach(term => {
      doc.text(`  • ${term}`, { width: 500 })
      doc.moveDown(0.3)
    })
    
    // Signature section
    doc.moveDown(1.5)
       .fillColor('#333')
       .font('Helvetica-Bold')
       .fontSize(12)
       .text('SIGNATURES', { underline: true })
    
    doc.moveDown(1)
    
    // Client signature
    doc.font('Helvetica')
       .fontSize(10)
       .text('Client Signature:')
    
    doc.moveDown(0.5)
    
    if (document.client_signature_type === 'drawn' && document.client_signature?.startsWith('data:image')) {
      try {
        const base64Data = document.client_signature.split(',')[1]
        const imgBuffer = Buffer.from(base64Data, 'base64')
        doc.image(imgBuffer, { width: 200, height: 50 })
      } catch {
        doc.font('Helvetica-Oblique')
           .text('[Drawn signature on file]')
      }
    } else if (document.client_signature) {
      doc.font('Helvetica-Oblique')
         .fontSize(16)
         .text(document.client_signature)
    }
    
    doc.moveDown(0.5)
       .font('Helvetica')
       .fontSize(9)
       .fillColor('#666')
    
    if (document.client_signed_at) {
      doc.text(`Signed: ${new Date(document.client_signed_at).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}`)
    }
    if (document.client_signed_ip) {
      doc.text(`IP Address: ${document.client_signed_ip}`)
    }
    
    // Footer
    doc.moveDown(2)
       .strokeColor('#eee')
       .lineWidth(1)
       .moveTo(50, doc.y)
       .lineTo(562, doc.y)
       .stroke()
    
    doc.moveDown(0.5)
       .fillColor('#999')
       .fontSize(8)
       .font('Helvetica')
       .text('Sunday Harmony Consulting · Brand, strategy, and systems.', { align: 'center' })
       .text('sundayharmony.com', { align: 'center' })
    
    doc.end()
  })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  
  const document = await getServiceDocument(id)
  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }
  
  if (document.status !== 'signed') {
    return NextResponse.json({ error: 'Document not yet signed' }, { status: 400 })
  }
  
  // Check access - allow owner or admin/staff
  const email = session.user.email.toLowerCase()
  const isOwner = document.client_email.toLowerCase() === email
  const isStaff = isAdminRole(session.user.role) || isStaffRole(session.user.role)
  
  if (!isOwner && !isStaff) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }
  
  try {
    const pdfBuffer = await generatePDF(document)
    
    const filename = `${document.document_number}-signed.pdf`
    
    // Convert Buffer to Uint8Array for NextResponse compatibility
    const uint8Array = new Uint8Array(pdfBuffer)
    
    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (err) {
    console.error('Failed to generate PDF:', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
