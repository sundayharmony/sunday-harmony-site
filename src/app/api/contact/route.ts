import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createLead, logActivity } from '@/lib/db'

// POST /api/contact
// Receives form data and sends email notification
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { firstName, lastName, email, phone, business, service, message } = body

    // Validation
    if (!firstName?.trim()) {
      return NextResponse.json({ error: 'First name is required' }, { status: 400 })
    }
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }
    if (!business?.trim()) {
      return NextResponse.json({ error: 'Business name is required' }, { status: 400 })
    }

    // Log the submission (always works, even without email config)
    const submission = {
      firstName,
      lastName,
      email,
      phone,
      business,
      service,
      message,
      timestamp: new Date().toISOString(),
    }

    // Send email if SMTP is configured
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })

      await transporter.sendMail({
        from: `"Sunday Harmony Website" <${process.env.SMTP_USER}>`,
        to: process.env.NOTIFY_EMAIL || 'sales@sundayharmony.com',
        replyTo: email,
        subject: `🎯 New Lead: ${firstName} ${lastName} from ${business}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#c9a96e;border-bottom:2px solid #c9a96e;padding-bottom:10px">
              New Contact Form Submission
            </h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;font-weight:bold;color:#666">Name</td><td style="padding:8px 0">${firstName} ${lastName}</td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;color:#666">Email</td><td style="padding:8px 0"><a href="mailto:${escHtml(email)}">${escHtml(email)}</a></td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;color:#666">Phone</td><td style="padding:8px 0">${phone ? `<a href="tel:${escHtml(phone)}">${escHtml(phone)}</a>` : 'Not provided'}</td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;color:#666">Business</td><td style="padding:8px 0">${escHtml(business)}</td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;color:#666">Service</td><td style="padding:8px 0">${service || 'Not specified'}</td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;color:#666">Message</td><td style="padding:8px 0">${message || 'No message'}</td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;color:#666">Submitted</td><td style="padding:8px 0">${new Date().toLocaleString()}</td></tr>
            </table>
            <p style="margin-top:20px;padding:12px;background:#f8f6f0;border-radius:8px;font-size:13px;color:#666">
              This lead came from the Sunday Harmony website contact form. Reply directly to this email to respond to ${firstName}.
            </p>
          </div>
        `,
      })

      console.log('✅ Notification email sent successfully')
    } else {
      console.log('ℹ️ SMTP not configured — email notification skipped. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env.local')
    }

    // Save lead to database
    try {
      const lead = await createLead({
        first_name: firstName,
        last_name: lastName || '',
        email,
        phone: body.phone,
        business,
        industry: body.industry,
        service,
        budget: body.budget,
        message,
      })
      if (lead) {
        logActivity({
          action: 'created',
          entity_type: 'lead',
          entity_id: lead.id,
          actor_email: email,
          details: `New lead from contact form: ${firstName} ${lastName} (${business})`,
        })
      }
    } catch (dbErr) {
      console.error('Failed to save lead to DB (email was still sent):', dbErr)
    }

    return NextResponse.json({ success: true, message: 'Thank you! We\'ll be in touch within 24 hours.' })
  } catch (error) {
    console.error('❌ Contact form error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again or email us directly at sales@sundayharmony.com' },
      { status: 500 }
    )
  }
}
