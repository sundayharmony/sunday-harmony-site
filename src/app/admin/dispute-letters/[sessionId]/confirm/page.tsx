import DisputeConfirmStep from '@/components/dispute-letters/DisputeConfirmStep'
import { redirectAppLinkedDisputeSession } from '@/lib/dispute-letters/redirect-app-linked'

type Params = { params: Promise<{ sessionId: string }> }

export default async function DisputeConfirmPage({ params }: Params) {
  const { sessionId } = await params
  await redirectAppLinkedDisputeSession(sessionId, 'confirm')
  return (
    <div className="p-6">
      <DisputeConfirmStep sessionId={sessionId} />
    </div>
  )
}
