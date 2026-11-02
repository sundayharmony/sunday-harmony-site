import type { Session } from 'next-auth'
import { NextResponse } from 'next/server'
import type { MarketingActor } from '@/lib/marketing-crm'

export function marketingActor(session: Session): MarketingActor {
  return {
    role: session.user.role,
    email: session.user.email,
    name: session.user.name,
    userId: session.user.id,
  }
}

export function marketingError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Something went wrong'
  const status = /not found/i.test(message) ? 404 : /cannot|forbidden|belongs|relations updates|sales creates/i.test(message) ? 403 : 400
  return NextResponse.json({ error: message }, { status })
}
