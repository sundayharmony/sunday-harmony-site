import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { createLead, findLeadByEmail, updateLead, type Lead } from '@/lib/db'
import { createMeeting, updateMeeting } from '@/lib/crm-db'
import { consultationCancelUrl, consultationEmailHtml } from '@/lib/consultation-email'
import {
  getBookingByCancelToken,
  getBookingById,
  getConsultationSettings,
  insertConsultationBooking,
  listConsultationBlackouts,
  listConsultationBusyRanges,
  listConsultationHours,
  listScheduledBookings,
  updateConsultationBooking,
  type ConsultationBookingRow,
} from '@/lib/consultation-db'
import {
  bookingsDueForReminder,
  buildConsultationSlots,
  formatConsultationWhen,
  formatSlotDay,
  formatSlotTime,
  isOpenSlot,
  localDateKey,
  type ConsultationSlot,
} from '@/lib/consultation-slots'
import { createMeetEvent, deleteCalendarEvent, isGoogleCalendarConfigured } from '@/lib/google-calendar'
import { getAdminNotifyEmail, isEmailConfigured, sanitizeEmailSubjectPart, sendEmail } from '@/lib/smtp-mail'

export type PublicSlotDay = {
  date: string
  label: string
  slots: { startsAt: string; endsAt: string; label: string }[]
}

const DEFAULT_SETTINGS = {
  timezone: 'America/New_York',
  slotMinutes: 30,
  bufferMinutes: 0,
  windowDays: 14,
  minLeadMinutes: 120,
}

const BUSY_LOOKBACK_MS = 24 * 60 * 60 * 1000
const BUSY_HORIZON_MS = 120 * 24 * 60 * 60 * 1000

export async function loadOpenSlots(now = new Date()): Promise<{
  settings: typeof DEFAULT_SETTINGS
  slots: ConsultationSlot[]
  calendarConnected: boolean
} | null> {
  const settings = (await getConsultationSettings()) ?? DEFAULT_SETTINGS
  const [hours, blackouts, bookings] = await Promise.all([
    listConsultationHours(),
    listConsultationBlackouts(),
    listConsultationBusyRanges(new Date(now.getTime() - BUSY_LOOKBACK_MS), new Date(now.getTime() + BUSY_HORIZON_MS)),
  ])
  const slots = buildConsultationSlots({
    now,
    settings,
    hours,
    blackoutDates: blackouts,
    busy: bookings.map((booking) => ({ startsAt: booking.starts_at, endsAt: booking.ends_at })),
  })
  return { settings, slots, calendarConnected: isGoogleCalendarConfigured() }
}

export type PublicSlotsPayload = {
  calendarConnected: boolean
  timezone: string
  slotMinutes: number
  days: PublicSlotDay[]
}

export async function loadPublicSlots(now = new Date()): Promise<PublicSlotsPayload> {
  const open = await loadOpenSlots(now)
  if (!open) {
    return { calendarConnected: false, timezone: DEFAULT_SETTINGS.timezone, slotMinutes: DEFAULT_SETTINGS.slotMinutes, days: [] }
  }
  return {
    calendarConnected: open.calendarConnected,
    timezone: open.settings.timezone,
    slotMinutes: open.settings.slotMinutes,
    days: groupSlots(open.slots, open.settings.timezone),
  }
}

export function refreshPublicConsultationCalendar() {
  try {
    revalidatePath('/book')
    revalidatePath('/api/consultations/slots')
  } catch (error) {
    console.error('consultation calendar refresh failed:', error)
  }
}

export function groupSlots(slots: ConsultationSlot[], timeZone: string): PublicSlotDay[] {
  const days = new Map<string, PublicSlotDay>()
  for (const slot of slots) {
    const start = new Date(slot.startsAt)
    const date = localDateKey(start, timeZone)
    const day = days.get(date) ?? { date, label: formatSlotDay(start, timeZone), slots: [] }
    day.slots.push({ ...slot, label: formatSlotTime(start, timeZone) })
    days.set(date, day)
  }
  return [...days.values()]
}

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/)
  return { first: parts[0] || name.trim(), last: parts.slice(1).join(' ') }
}

async function sendBookingMail(opts: {
  kind: 'confirmation' | 'reminder'
  booking: ConsultationBookingRow
  whenLabel: string
  meetLink: string
}): Promise<void> {
  if (!isEmailConfigured()) return
  const first = splitName(opts.booking.guest_name).first
  const cancelUrl = consultationCancelUrl(opts.booking.cancel_token)
  await sendEmail({
    to: opts.booking.guest_email,
    subject: sanitizeEmailSubjectPart(
      opts.kind === 'reminder' ? `Reminder: consultation on ${opts.whenLabel}` : `Consultation booked — ${opts.whenLabel}`,
      180
    ),
    html: consultationEmailHtml({
      kind: opts.kind,
      audience: 'guest',
      greetingName: first,
      whenLabel: opts.whenLabel,
      meetLink: opts.meetLink,
      cancelUrl,
    }),
  })
  if (opts.kind === 'confirmation') {
    const owner = getAdminNotifyEmail()
    if (owner.toLowerCase() !== opts.booking.guest_email.toLowerCase()) {
      await sendEmail({
        to: owner,
        subject: sanitizeEmailSubjectPart(`New consultation: ${opts.booking.guest_name}`, 180),
        html: consultationEmailHtml({
          kind: 'confirmation',
          audience: 'owner',
          greetingName: opts.booking.guest_name,
          whenLabel: opts.whenLabel,
          meetLink: opts.meetLink,
          business: opts.booking.business,
          guestEmail: opts.booking.guest_email,
        }),
      })
    }
  }
}

export async function bookConsultation(input: {
  name: string
  email: string
  phone: string
  business: string
  note: string
  startsAt: string
  now?: Date
}): Promise<
  | { ok: true; whenLabel: string; emailed: boolean }
  | { ok: false; status: number; error: string }
> {
  if (!isGoogleCalendarConfigured()) {
    return { ok: false, status: 503, error: 'Online booking is not open yet. Send a message and we will find a time.' }
  }
  const now = input.now ?? new Date()
  const open = await loadOpenSlots(now)
  if (!open) {
    return { ok: false, status: 503, error: 'Booking is not set up yet.' }
  }
  const slot = isOpenSlot(input.startsAt, open.slots)
  if (!slot) {
    return { ok: false, status: 409, error: 'That time is no longer open. Pick another slot.' }
  }

  const inserted = await insertConsultationBooking({
    guest_name: input.name.trim(),
    guest_email: input.email.trim(),
    guest_phone: input.phone.trim(),
    business: input.business.trim(),
    note: input.note.trim(),
    starts_at: slot.startsAt,
    ends_at: slot.endsAt,
    cancel_token: crypto.randomBytes(24).toString('base64url'),
  })
  if ('conflict' in inserted) {
    return { ok: false, status: 409, error: 'That time was just taken. Pick another slot.' }
  }
  if ('error' in inserted) {
    return { ok: false, status: 500, error: inserted.error }
  }

  const booking = inserted.booking
  const whenLabel = formatConsultationWhen(new Date(slot.startsAt), open.settings.timezone)
  let meet: { eventId: string; meetLink: string }
  try {
    meet = await createMeetEvent({
      summary: `Consultation with ${input.name.trim()}`,
      description: [
        `Business: ${input.business.trim()}`,
        input.phone.trim() ? `Phone: ${input.phone.trim()}` : '',
        input.note.trim() ? `Note: ${input.note.trim()}` : '',
        `Email: ${input.email.trim()}`,
      ]
        .filter(Boolean)
        .join('\n'),
      startsAt: new Date(slot.startsAt),
      endsAt: new Date(slot.endsAt),
      attendeeEmail: input.email.trim(),
      timeZone: open.settings.timezone,
    })
  } catch (error) {
    console.error('createMeetEvent failed:', error)
    await updateConsultationBooking(booking.id, { status: 'cancelled' })
    return { ok: false, status: 502, error: 'We could not create the Google Meet. Please try another time or send a message.' }
  }

  const { first, last } = splitName(input.name)
  const existingLead = await findLeadByEmail(input.email)
  let lead: Lead | null | undefined = existingLead
  if (!lead) {
    lead = await createLead({
      first_name: first,
      last_name: last,
      email: input.email.trim(),
      phone: input.phone.trim(),
      business: input.business.trim(),
      message: input.note.trim(),
      service: 'Consultation',
      source: 'inbound',
      lead_type: 'marketing_lead',
      marketing_lead_status: 'consultation_scheduled',
    })
  } else {
    const updates: Parameters<typeof updateLead>[1] = {}
    if (existingLead?.marketing_lead_status !== 'converted') {
      updates.marketing_lead_status = 'consultation_scheduled'
    }
    if (!(existingLead?.phone || '').trim() && input.phone.trim()) updates.phone = input.phone.trim()
    if (!(existingLead?.business || '').trim() && input.business.trim()) updates.business = input.business.trim()
    if (!(existingLead?.message || '').trim() && input.note.trim()) updates.message = input.note.trim()
    if (Object.keys(updates).length > 0) {
      lead = (await updateLead(existingLead!.id, updates)) ?? existingLead
    }
  }

  let meetingId: string | null = null
  if (lead) {
    const meeting = await createMeeting({
      client_id: lead.client_id ?? null,
      lead_id: lead.id,
      application_uuid: null,
      title: `Consultation with ${input.name.trim()}`,
      meeting_type: 'consultation',
      scheduled_at: slot.startsAt,
      duration_minutes: open.settings.slotMinutes,
      notes: input.note.trim(),
      assigned_staff: getAdminNotifyEmail(),
      google_meet_link: meet.meetLink,
      status: 'scheduled',
      created_by: 'website',
    })
    meetingId = meeting?.id ?? null
  }

  await updateConsultationBooking(booking.id, {
    meet_link: meet.meetLink,
    calendar_event_id: meet.eventId,
    lead_id: lead?.id ?? null,
    meeting_id: meetingId,
  })

  let emailed = false
  try {
    await sendBookingMail({
      kind: 'confirmation',
      booking: { ...booking, meet_link: meet.meetLink },
      whenLabel,
      meetLink: meet.meetLink,
    })
    emailed = isEmailConfigured()
    if (emailed) {
      await updateConsultationBooking(booking.id, { confirmation_sent_at: new Date().toISOString() })
    }
  } catch (error) {
    console.error('consultation confirmation email failed:', error)
  }

  refreshPublicConsultationCalendar()
  return { ok: true, whenLabel, emailed }
}

export async function cancelConsultationByToken(token: string): Promise<{ ok: true; already?: boolean } | { ok: false; error: string }> {
  const booking = await getBookingByCancelToken(token.trim())
  if (!booking) return { ok: false, error: 'That cancellation link is not valid.' }
  return cancelBookingRecord(booking)
}

export async function cancelConsultationById(id: string): Promise<{ ok: true; already?: boolean } | { ok: false; error: string }> {
  const booking = await getBookingById(id)
  if (!booking) return { ok: false, error: 'Booking not found.' }
  return cancelBookingRecord(booking)
}

async function cancelBookingRecord(
  booking: ConsultationBookingRow
): Promise<{ ok: true; already?: boolean } | { ok: false; error: string }> {
  if (booking.status === 'cancelled') return { ok: true, already: true }
  if (booking.calendar_event_id) {
    try {
      await deleteCalendarEvent(booking.calendar_event_id)
    } catch (error) {
      console.error('deleteCalendarEvent failed:', error)
    }
  }
  const updated = await updateConsultationBooking(booking.id, { status: 'cancelled' })
  if (!updated) return { ok: false, error: 'Could not cancel the booking.' }
  refreshPublicConsultationCalendar()
  if (booking.meeting_id) {
    await updateMeeting(booking.meeting_id, { status: 'cancelled' })
  }
  return { ok: true }
}

export async function sendDueConsultationReminders(now = new Date()): Promise<{ sent: number }> {
  const settings = (await getConsultationSettings()) ?? DEFAULT_SETTINGS
  const bookings = await listScheduledBookings()
  const due = bookingsDueForReminder(
    bookings.map((booking) => ({
      ...booking,
      reminderSentAt: booking.reminder_sent_at,
      confirmationSentAt: booking.confirmation_sent_at,
      startsAt: booking.starts_at,
      meetLink: booking.meet_link,
    })),
    now
  )
  let sent = 0
  for (const booking of due) {
    if (!booking.meet_link) continue
    const whenLabel = formatConsultationWhen(new Date(booking.starts_at), settings.timezone)
    try {
      await sendBookingMail({ kind: 'reminder', booking, whenLabel, meetLink: booking.meet_link })
      await updateConsultationBooking(booking.id, { reminder_sent_at: now.toISOString() })
      sent += 1
    } catch (error) {
      console.error('consultation reminder failed:', booking.id, error)
    }
  }
  return { sent }
}
