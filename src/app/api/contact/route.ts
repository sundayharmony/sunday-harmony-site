import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createLead, logActivity } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Sanitize user input for HTML email templates
function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// POST /api/contact
// Receives form data and sends email notification
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 3 submissions per 15 minutes per IP
    const ip = getClientIp(req)
    const rl = rateLimit(`contact:${ip}`, 3, 15 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { firstName, lastName, email, phone, business, service, message } = body

    // Input length validation â prevent oversized payloads
    if (typeof firstName === 'string' && firstName.length > 100) {
      return NextResponse.json({ error: 'First name is too long' }, { status: 400 })
    }
    if (typeof lastName === 'string' && lastName.length > 100) {
      return NextResponse.json({ error: 'Last name is too long' }, { status: 400 })
    }
    if (typeof email === 'string' && email.length > 254) {
      return NextResponse.json({ error: 'Email is too long' }, { status: 400 })
    }
    if (typeof phone === 'string' && phone.length > 30) {
      return NextResponse.json({ error: 'Phone number is too long' }, { status: 400 })
    }
    if (typeof business === 'string' && business.length > 200) {
      return NextResponse.json({ error: 'Business name is too long' }, { status: 400 })
    }
    if (typeof message === 'string' && message.length > 5000) {
      return NextResponse.json({ error: 'Message is too long (max 5000 characters)' }, { status: 400 })
    }

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
        subject: `New Lead: ${firstName} ${lastName} from ${business}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#c9a96e;border-bottom:2px solid #c9a96e;padding-bottom:10px">
              New Contact Form Submission
            </h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;font-weight:bold;color:#666">Name</td><td style="padding:8px 0">${escHtml(firstName)} ${escHtml(lastName)}</td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;color:#666">Email</td><td style="padding:8px 0"><a href="mailto:${escHtml(email)}">${escHtml(email)}</a></td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;color:#666">Phone</td><td style="padding:8px 0">${phone ? `<a href="tel:${escHtml(phone)}">${escHtml(phone)}</a>` : 'Not provided'}</td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;color:#666">Business</td><td style="padding:8px 0">${escHtml(business)}</td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;color:#666">Service</td><td style="padding:8px 0">${service ? escHtml(service) : 'Not specified'}</td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;color:#666">Message</td><td style="padding:8px 0">${message ? escHtml(message) : 'No message'}</td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;color:#666">Submitted</td><td style="padding:8px 0">${new Date().toLocaleString()}</td></tr>
            </table>
            <p style="margin-top:20px;padding:12px;background:#f8f6f0;border-radius:8px;font-size:13px;color:#666">
              This lead came from the Sunday Harmony website contact form. Reply directly to this email to respond to ${escHtml(firstName)}.
            </p>
          </div>
        `,
      })

      // Email sent successfully
    } else {
      // SMTP not configured â email notification skipped
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
    console.error('â Contact form error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again or email us directly at sales@sundayharmony.com' },
      { status: 500 }
    )
  }
}
