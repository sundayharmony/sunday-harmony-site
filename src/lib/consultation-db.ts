import { getSupabase } from './supabase'
import type { ConsultationSettings, WeeklyWindow } from './consultation-slots'

export type ConsultationBookingRow = {
  id: string
  guest_name: string
  guest_email: string
  guest_phone: string
  business: string
  note: string
  starts_at: string
  ends_at: string
  meet_link: string | null
  calendar_event_id: string | null
  lead_id: string | null
  meeting_id: string | null
  status: 'scheduled' | 'cancelled'
  cancel_token: string
  confirmation_sent_at: string | null
  reminder_sent_at: string | null
  created_at: string
}

type SettingsRow = {
  timezone: string
  slot_minutes: number
  buffer_minutes: number
  window_days: number
  min_lead_minutes: number
}

function mapSettings(row: SettingsRow): ConsultationSettings {
  return {
    timezone: row.timezone,
    slotMinutes: row.slot_minutes,
    bufferMinutes: row.buffer_minutes,
    windowDays: row.window_days,
    minLeadMinutes: row.min_lead_minutes,
  }
}

export async function getConsultationSettings(): Promise<ConsultationSettings | null> {
  const { data, error } = await getSupabase().from('consultation_settings').select('*').eq('id', 1).maybeSingle()
  if (error || !data) {
    if (error && error.code !== '42P01') console.error('getConsultationSettings error:', error)
    return null
  }
  return mapSettings(data as SettingsRow)
}

export async function saveConsultationSettings(settings: ConsultationSettings): Promise<ConsultationSettings | null> {
  const { data, error } = await getSupabase()
    .from('consultation_settings')
    .upsert({
      id: 1,
      timezone: settings.timezone,
      slot_minutes: settings.slotMinutes,
      buffer_minutes: settings.bufferMinutes,
      window_days: settings.windowDays,
      min_lead_minutes: settings.minLeadMinutes,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()
  if (error || !data) {
    console.error('saveConsultationSettings error:', error)
    return null
  }
  return mapSettings(data as SettingsRow)
}

export async function listConsultationHours(): Promise<WeeklyWindow[]> {
  const { data, error } = await getSupabase()
    .from('consultation_hours')
    .select('weekday, start_minute, end_minute')
    .order('weekday')
    .order('start_minute')
  if (error) {
    if (error.code !== '42P01') console.error('listConsultationHours error:', error)
    return []
  }
  return (data || []).map((row: { weekday: number; start_minute: number; end_minute: number }) => ({
    weekday: row.weekday,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
  }))
}

export async function replaceConsultationHours(hours: WeeklyWindow[]): Promise<boolean> {
  const supabase = getSupabase()
  const { error: clearError } = await supabase.from('consultation_hours').delete().gte('weekday', 0)
  if (clearError) {
    console.error('replaceConsultationHours clear error:', clearError)
    return false
  }
  if (!hours.length) return true
  const { error } = await supabase.from('consultation_hours').insert(
    hours.map((hour) => ({
      weekday: hour.weekday,
      start_minute: hour.startMinute,
      end_minute: hour.endMinute,
    }))
  )
  if (error) {
    console.error('replaceConsultationHours insert error:', error)
    return false
  }
  return true
}

export async function listConsultationBlackouts(): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from('consultation_blackouts')
    .select('blackout_date')
    .order('blackout_date')
  if (error) {
    if (error.code !== '42P01') console.error('listConsultationBlackouts error:', error)
    return []
  }
  return (data || []).map((row: { blackout_date: string }) => String(row.blackout_date).slice(0, 10))
}

export async function replaceConsultationBlackouts(dates: string[]): Promise<boolean> {
  const supabase = getSupabase()
  const { error: clearError } = await supabase.from('consultation_blackouts').delete().not('id', 'is', null)
  if (clearError) {
    console.error('replaceConsultationBlackouts clear error:', clearError)
    return false
  }
  if (!dates.length) return true
  const { error } = await supabase.from('consultation_blackouts').insert(dates.map((blackout_date) => ({ blackout_date })))
  if (error) {
    console.error('replaceConsultationBlackouts insert error:', error)
    return false
  }
  return true
}

export async function listScheduledBookings(): Promise<ConsultationBookingRow[]> {
  const { data, error } = await getSupabase()
    .from('consultation_bookings')
    .select('*')
    .eq('status', 'scheduled')
    .order('starts_at')
  if (error) {
    if (error.code !== '42P01') console.error('listScheduledBookings error:', error)
    return []
  }
  return (data || []) as ConsultationBookingRow[]
}

/** Scheduled bookings that overlap a window. Slot building only needs the times. */
export async function listConsultationBusyRanges(
  from: Date,
  to: Date
): Promise<Array<{ starts_at: string; ends_at: string }>> {
  const { data, error } = await getSupabase()
    .from('consultation_bookings')
    .select('starts_at, ends_at')
    .eq('status', 'scheduled')
    .lt('starts_at', to.toISOString())
    .gt('ends_at', from.toISOString())
  if (error) {
    if (error.code !== '42P01') console.error('listConsultationBusyRanges error:', error)
    return []
  }
  return (data || []) as Array<{ starts_at: string; ends_at: string }>
}

export async function listUpcomingBookings(now = new Date()): Promise<ConsultationBookingRow[]> {
  const { data, error } = await getSupabase()
    .from('consultation_bookings')
    .select('*')
    .eq('status', 'scheduled')
    .gte('starts_at', now.toISOString())
    .order('starts_at')
  if (error) {
    if (error.code !== '42P01') console.error('listUpcomingBookings error:', error)
    return []
  }
  return (data || []) as ConsultationBookingRow[]
}

export async function insertConsultationBooking(row: {
  guest_name: string
  guest_email: string
  guest_phone: string
  business: string
  note: string
  starts_at: string
  ends_at: string
  cancel_token: string
}): Promise<{ booking: ConsultationBookingRow } | { conflict: true } | { error: string }> {
  const { data, error } = await getSupabase().from('consultation_bookings').insert(row).select('*').single()
  if (error) {
    if (error.code === '23505') return { conflict: true }
    console.error('insertConsultationBooking error:', error)
    return { error: 'Could not save the booking' }
  }
  return { booking: data as ConsultationBookingRow }
}

export async function updateConsultationBooking(
  id: string,
  updates: Partial<
    Pick<
      ConsultationBookingRow,
      | 'meet_link'
      | 'calendar_event_id'
      | 'lead_id'
      | 'meeting_id'
      | 'status'
      | 'confirmation_sent_at'
      | 'reminder_sent_at'
    >
  >
): Promise<ConsultationBookingRow | null> {
  const { data, error } = await getSupabase()
    .from('consultation_bookings')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()
  if (error || !data) {
    console.error('updateConsultationBooking error:', error)
    return null
  }
  return data as ConsultationBookingRow
}

export async function getBookingByCancelToken(token: string): Promise<ConsultationBookingRow | null> {
  const { data, error } = await getSupabase()
    .from('consultation_bookings')
    .select('*')
    .eq('cancel_token', token)
    .maybeSingle()
  if (error || !data) return null
  return data as ConsultationBookingRow
}

export async function getBookingById(id: string): Promise<ConsultationBookingRow | null> {
  const { data, error } = await getSupabase().from('consultation_bookings').select('*').eq('id', id).maybeSingle()
  if (error || !data) return null
  return data as ConsultationBookingRow
}
