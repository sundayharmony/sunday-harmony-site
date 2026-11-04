import type { Metadata } from 'next'
import StaffDirectMessages from '@/components/admin/StaffDirectMessages'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Messages',
}

export default function AdminStaffMessagesPage() {
  return <StaffDirectMessages />
}
