// Client-safe document status utilities
// Separate from service-documents.ts to avoid pulling in nodemailer

export type DocumentStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'expired' | 'cancelled'

export function formatDocumentStatusBadge(status: DocumentStatus): { label: string; color: string } {
  switch (status) {
    case 'draft':
      return { label: 'Draft', color: 'bg-gray-100 text-gray-700' }
    case 'sent':
      return { label: 'Sent', color: 'bg-blue-100 text-blue-700' }
    case 'viewed':
      return { label: 'Viewed', color: 'bg-yellow-100 text-yellow-700' }
    case 'signed':
      return { label: 'Signed', color: 'bg-green-100 text-green-700' }
    case 'expired':
      return { label: 'Expired', color: 'bg-red-100 text-red-700' }
    case 'cancelled':
      return { label: 'Cancelled', color: 'bg-gray-100 text-gray-500' }
    default:
      return { label: status, color: 'bg-gray-100 text-gray-700' }
  }
}
