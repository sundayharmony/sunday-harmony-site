import { isSalesRole } from '@/lib/staff-roles'
import type { OutreachStore } from './store'
import { deliveryStateFor, type BookingSnapshot, type DeliveryState, type LeadSnapshot, type QueueItem } from './types'

export type HandoffRecord = {
  queueId: string
  prospect: {
    id: string
    business: string
    name: string
    email: string
    website: string | null
    location: string | null
    opportunity: string | null
    stage: string | null
    source: string | null
  }
  customMessage: string
  acceptedAt: string | null
  contactedAt: string | null
  deliveryState: DeliveryState
  booking: BookingSnapshot
  phone: string | null
}

export function canViewHandoff(role?: string | null): boolean {
  return isSalesRole(role)
}

export async function buildHandoff(
  store: OutreachStore,
  item: QueueItem,
  lead: LeadSnapshot | null
): Promise<HandoffRecord> {
  const booking = await store.getBooking(item.leadId, item.emailNormalized)
  const name = [lead?.firstName, lead?.lastName].filter(Boolean).join(' ').trim()
  return {
    queueId: item.id,
    prospect: {
      id: item.leadId,
      business: lead?.business || item.groundedFacts.business,
      name,
      email: item.emailRaw,
      website: lead?.website || item.groundedFacts.website,
      location: lead?.locationText || item.groundedFacts.location,
      opportunity: lead?.marketingOpportunity || item.groundedFacts.observation,
      stage: lead?.pipelineStage || null,
      source: lead?.source || null,
    },
    customMessage: item.textBody,
    acceptedAt: item.acceptedAt,
    contactedAt: item.contactedLeadUpdatedAt || lead?.lastContactedAt || null,
    deliveryState: deliveryStateFor(item),
    booking,
    phone: lead?.phone?.trim() || null,
  }
}
