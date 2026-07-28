import { redirect } from 'next/navigation'
import DisputeHealthStep from '@/components/dispute-letters/DisputeHealthStep'
import { redirectAppLinkedDisputeSession } from '@/lib/dispute-letters/redirect-app-linked'

type Params = { params: Promise<{ sessionId: string }> }

export default async function DisputeHealthPage({ params }: Params) {
  const { sessionId } = await params
  await redirectAppLinkedDisputeSession(sessionId, 'health')
  return (
    <div className="p-6">
      <DisputeHealthStep sessionId={sessionId} />
    </div>
  )
}
