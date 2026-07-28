import DisputeReviewStep from '@/components/dispute-letters/DisputeReviewStep'
import { redirectAppLinkedDisputeSession } from '@/lib/dispute-letters/redirect-app-linked'

type Params = { params: Promise<{ sessionId: string }> }

export default async function DisputeReviewPage({ params }: Params) {
  const { sessionId } = await params
  await redirectAppLinkedDisputeSession(sessionId, 'review')
  return (
    <div className="p-6">
      <DisputeReviewStep sessionId={sessionId} />
    </div>
  )
}
